use anyhow::{Context, Result};
use rusqlite::{ffi::sqlite3_auto_extension, params, Connection};
use serde::Deserialize;
use sqlite_vec::sqlite3_vec_init;
use std::sync::Mutex;
use zerocopy::AsBytes;

use super::embeddings::EmbeddingEngine;
use crate::services::types::KnowledgeChunk;

#[derive(Deserialize)]
struct SeedFile {
    game_id: String,
    entries: Vec<SeedEntry>,
}

#[derive(Deserialize)]
struct SeedEntry {
    category: String,
    title: String,
    content: String,
}

pub struct RagDatabase {
    conn: Mutex<Connection>,
    engine: Mutex<EmbeddingEngine>,
}

impl RagDatabase {
    pub fn new(db_path: &str) -> Result<Self> {
        // Register sqlite-vec extension before opening any connection
        unsafe {
            sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite3_vec_init as *const (),
            )));
        }

        // Ensure parent directory exists
        if let Some(parent) = std::path::Path::new(db_path).parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(db_path)
            .context("Failed to open RAG database")?;

        // Verify sqlite-vec loaded
        let vec_version: String = conn
            .query_row("SELECT vec_version()", [], |r| r.get(0))
            .context("sqlite-vec extension not loaded")?;
        tracing::info!("sqlite-vec {vec_version} loaded");

        // Create schema
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS knowledge (
                id INTEGER PRIMARY KEY,
                game_id TEXT NOT NULL,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(
                embedding float[384]
            );"
        )
        .context("Failed to create RAG schema")?;

        let engine = EmbeddingEngine::new()
            .context("Failed to initialize embedding engine")?;

        Ok(Self {
            conn: Mutex::new(conn),
            engine: Mutex::new(engine),
        })
    }

    /// Check if the knowledge table has any rows.
    pub fn is_seeded(&self) -> bool {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM knowledge", [], |r| r.get(0))
            .unwrap_or(0);
        count > 0
    }

    /// Seed the database from a JSON byte slice. Returns the number of entries inserted.
    pub fn seed_from_json(&self, json_bytes: &[u8]) -> Result<usize> {
        let seed_file: SeedFile =
            serde_json::from_slice(json_bytes).context("Failed to parse seed JSON")?;

        let game_id = &seed_file.game_id;
        let entries = &seed_file.entries;

        if entries.is_empty() {
            return Ok(0);
        }

        // Build texts for batch embedding: "title: content"
        let texts: Vec<String> = entries
            .iter()
            .map(|e| format!("{}: {}", e.title, e.content))
            .collect();

        // Batch embed
        let embeddings = {
            let engine = self.engine.lock().unwrap();
            engine.embed_batch(&texts).context("Batch embedding failed")?
        };

        // Insert into both tables
        let conn = self.conn.lock().unwrap();
        let tx = conn.unchecked_transaction().context("Failed to begin transaction")?;

        {
            let mut insert_knowledge = tx
                .prepare("INSERT INTO knowledge (game_id, category, title, content) VALUES (?1, ?2, ?3, ?4)")
                .context("Failed to prepare knowledge insert")?;

            let mut insert_vec = tx
                .prepare("INSERT INTO knowledge_vec (rowid, embedding) VALUES (?1, ?2)")
                .context("Failed to prepare vector insert")?;

            for (i, entry) in entries.iter().enumerate() {
                let rowid = insert_knowledge
                    .insert(params![game_id, entry.category, entry.title, entry.content])
                    .context("Failed to insert knowledge entry")?;

                insert_vec
                    .execute(params![rowid, embeddings[i].as_bytes()])
                    .context("Failed to insert vector")?;
            }
        }

        tx.commit().context("Failed to commit seed transaction")?;

        tracing::info!("Seeded {} entries for game '{game_id}'", entries.len());
        Ok(entries.len())
    }

    /// Search for relevant knowledge chunks using vector similarity.
    pub fn search(&self, query: &str, game_id: &str, limit: usize) -> Result<Vec<KnowledgeChunk>> {
        // Embed the query
        let query_embedding = {
            let engine = self.engine.lock().unwrap();
            engine.embed_text(query).context("Failed to embed query")?
        };

        let conn = self.conn.lock().unwrap();

        // Over-fetch from vector table, then filter by game_id
        let fetch_limit = limit * 5;
        let mut stmt = conn
            .prepare(
                "SELECT k.id, k.game_id, k.category, k.title, k.content, kv.distance
                 FROM knowledge_vec kv
                 JOIN knowledge k ON k.id = kv.rowid
                 WHERE kv.embedding MATCH ?1
                   AND k.game_id = ?2
                 ORDER BY kv.distance
                 LIMIT ?3",
            )
            .context("Failed to prepare search query")?;

        let results = stmt
            .query_map(
                params![query_embedding.as_bytes(), game_id, fetch_limit as i64],
                |row| {
                    Ok(KnowledgeChunk {
                        id: row.get::<_, i64>(0)?.to_string(),
                        game_id: row.get(1)?,
                        category: row.get(2)?,
                        title: row.get(3)?,
                        content: row.get(4)?,
                        relevance_score: 1.0 - row.get::<_, f32>(5)?,
                    })
                },
            )
            .context("Search query failed")?
            .collect::<Result<Vec<_>, _>>()
            .context("Failed to collect search results")?;

        // Take only the requested limit
        let results: Vec<KnowledgeChunk> = results.into_iter().take(limit).collect();

        tracing::debug!(
            "RAG search for '{}' (game={}) returned {} results",
            query,
            game_id,
            results.len()
        );

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_seed_json() -> &'static [u8] {
        br#"{
            "game_id": "testgame",
            "entries": [
                {"category": "basics", "title": "Movement", "content": "Use WASD to move around the map"},
                {"category": "basics", "title": "Jumping", "content": "Press Space to jump over obstacles"},
                {"category": "combat", "title": "Shooting", "content": "Left click to fire your weapon at enemies"}
            ]
        }"#
    }

    #[test]
    #[ignore] // Requires fastembed model download (~38MB)
    fn test_new_creates_database() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = RagDatabase::new(db_path.to_str().unwrap()).unwrap();
        assert!(!db.is_seeded());
    }

    #[test]
    #[ignore]
    fn test_seed_from_json() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = RagDatabase::new(db_path.to_str().unwrap()).unwrap();

        let count = db.seed_from_json(test_seed_json()).unwrap();
        assert_eq!(count, 3);
        assert!(db.is_seeded());
    }

    #[test]
    #[ignore]
    fn test_search_returns_results() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = RagDatabase::new(db_path.to_str().unwrap()).unwrap();
        db.seed_from_json(test_seed_json()).unwrap();

        let results = db.search("how do I move", "testgame", 5).unwrap();
        assert!(!results.is_empty());
        assert!(results.len() <= 5);
        // All results should be for the correct game
        for r in &results {
            assert_eq!(r.game_id, "testgame");
        }
    }

    #[test]
    #[ignore]
    fn test_search_wrong_game_empty() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = RagDatabase::new(db_path.to_str().unwrap()).unwrap();
        db.seed_from_json(test_seed_json()).unwrap();

        let results = db.search("movement", "nonexistent_game", 5).unwrap();
        assert!(results.is_empty());
    }
}
