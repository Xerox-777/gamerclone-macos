/**
 * GamerClone - Game Profiles
 * Specific context and coaching knowledge for popular games
 */

const gameProfiles = {
  // ============================================================
  // GENERIC PROFILE (fallback)
  // ============================================================
  generic: {
    id: 'generic',
    name: 'Generic Game',
    icon: '🎮',
    context: `This is a general gaming context. Analyze what you see in the screenshots and provide helpful guidance based on common gaming principles.`,
    tips: `
- Look for health/stamina indicators
- Identify objectives or goals visible on screen
- Note any enemy positions or threats
- Consider resource management (ammo, items, currency)
- Watch for environmental hazards or opportunities
`
  },

  // ============================================================
  // SANDBOX / SURVIVAL
  // ============================================================
  minecraft: {
    id: 'minecraft',
    name: 'Minecraft',
    icon: '⛏️',
    context: `Minecraft is a sandbox survival/creative game. Players gather resources, craft items, build structures, and survive against mobs. Key mechanics include mining, crafting, farming, enchanting, brewing, and exploring various dimensions (Overworld, Nether, End).`,
    tips: `
- Resource prioritization: wood → stone → iron → diamond
- Always carry torches, food, and a water bucket
- Never dig straight down (lava/cave danger)
- Creepers are silent - watch for green in peripheral vision
- F3 screen shows coordinates, biome, light level
- Beds set spawn point and skip night
- Enchanting requires bookshelves around the table
- Nether portal requires obsidian (4x5 minimum frame)
- The End requires Eyes of Ender to locate strongholds
- Villager trading can provide valuable items
`
  },

  valheim: {
    id: 'valheim',
    name: 'Valheim',
    icon: '⚔️',
    context: `Valheim is a Viking survival game. Players explore a procedurally generated world, defeat bosses, build bases, and progress through biome-based ages (Meadows → Black Forest → Swamp → Mountains → Plains → Mistlands).`,
    tips: `
- Always have rested bonus active before combat
- Food determines max health AND stamina
- Parrying is more effective than blocking
- Workbench/forge upgrades are essential for better gear
- Portals can't transport metal ores
- Each biome boss unlocks new progression abilities
- Comfort level affects rested bonus duration
- Sailing requires wind direction awareness
- Trolls can be used to mine copper/tin
- Build bee houses for steady honey supply
`
  },

  terraria: {
    id: 'terraria',
    name: 'Terraria',
    icon: '🌳',
    context: `Terraria is a 2D sandbox action-adventure game. Players mine, build, fight bosses, and progress through pre-Hardmode and Hardmode content. Class builds (melee, ranged, magic, summoner) become important in later game.`,
    tips: `
- Prepare arena with platforms and heart statues before boss fights
- Corruption/Crimson spreads in Hardmode - contain it early
- NPCs need valid housing (6x10 minimum, light, furniture)
- Reforge accessories at Goblin Tinkerer for better stats
- Life Crystals found underground max at 400 HP
- Wall of Flesh triggers Hardmode - prepare first
- Cobalt/Palladium → Mythril/Orichalcum → Adamantite/Titanium
- Mobility accessories (wings, boots) are crucial
- Underground Jungle contains important pre-Hardmode gear
- Fishing can provide powerful early-game items
`
  },

  // ============================================================
  // FPS / SHOOTERS
  // ============================================================
  valorant: {
    id: 'valorant',
    name: 'Valorant',
    icon: '🎯',
    context: `Valorant is a tactical 5v5 character-based shooter. Teams alternate attacking (plant spike) and defending. Each agent has unique abilities. Economy management and crosshair placement are crucial.`,
    tips: `
- Crosshair placement at head level saves reaction time
- Don't run and shoot - stop moving for accuracy
- Learn 2-3 agents well before expanding
- Economy: full buy at 4000+, force buy, or full save
- Clear angles one at a time, don't wide swing multiple
- Use abilities to gather info, not just for kills
- Communicate enemy positions with callouts
- Trade kills - don't let teammates die for free
- Post-plant positions should cover multiple angles
- Ultimate orbs and economy are team resources
`
  },

  csgo: {
    id: 'csgo',
    name: 'CS2 / CS:GO',
    icon: '💣',
    context: `Counter-Strike is a tactical 5v5 shooter. Terrorists plant the bomb, Counter-Terrorists defuse. Precise aim, utility usage, and economy management define high-level play.`,
    tips: `
- Counter-strafe to stop instantly for accurate shots
- Learn essential smokes, flashes, and mollies for each map
- Economy: buy as a team, never half-buy alone
- Check common angles and prefire spots
- Trade kills immediately when teammate dies
- Sound cues reveal enemy positions - use them
- AWP: hold angles, don't peek aggressively
- Rifles: tap/burst at range, spray up close
- Time management: 40 seconds to plant is often enough
- Default setups before executing allows flexibility
`
  },

  fortnite: {
    id: 'fortnite',
    name: 'Fortnite',
    icon: '🏗️',
    context: `Fortnite is a battle royale with building mechanics. 100 players fight until one remains. Building provides cover and high ground advantage. Storm circles force players toward center.`,
    tips: `
- Land at the edge of named POIs for safer looting
- 90s and ramp rushes for quick high ground
- Edit plays: window peek, floor edit, reset
- Always carry mats: 500 wood minimum
- Shield is priority - 200 effective HP vs 100
- Third party fights when opponents are weak
- Storm positioning: rotate early with edge
- Box fighting: edit out, not just hold walls
- Shotgun + SMG combo for close range
- Fishing spots provide shields and weapons
`
  },

  apex: {
    id: 'apex',
    name: 'Apex Legends',
    icon: '🦅',
    context: `Apex Legends is a squad-based battle royale with unique character abilities. Teams of 3 fight across Kings Canyon, World's Edge, or other maps. Movement and positioning are key.`,
    tips: `
- Slide jumping maintains momentum - never just run
- Armor swaps mid-fight are faster than healing
- Ping everything - communication wins fights
- High ground advantage is massive in Apex
- Know your legend's role: assault, recon, support, controller
- Rotate through buildings for cover, not open ground
- Knockdown shields can buy revive time
- Ring damage increases each round - respect it
- Replicators can craft key attachments and meds
- Care packages often worth the risk for red weapons
`
  },

  overwatch: {
    id: 'overwatch',
    name: 'Overwatch 2',
    icon: '🦸',
    context: `Overwatch 2 is a 5v5 hero shooter with role-based gameplay (Tank, Damage, Support). Teams fight over objectives in various game modes. Team composition and ultimate economy are crucial.`,
    tips: `
- Group up - staggered deaths lose fights
- Ultimate tracking: count enemy ults, combo yours
- Tank creates space, DPS punishes, Support enables
- High ground control wins most fights
- Counter-pick when hard countered
- Peel for your supports - they keep you alive
- Focus fire on one target rather than spreading damage
- Save defensive ults for enemy offensive ults
- Natural cover > shield reliance
- Win condition: identify how your comp wins and execute
`
  },

  // ============================================================
  // MOBA / STRATEGY
  // ============================================================
  lol: {
    id: 'lol',
    name: 'League of Legends',
    icon: '⚡',
    context: `League of Legends is a 5v5 MOBA. Two teams fight to destroy the enemy Nexus. Lanes (top, mid, bot) and jungle roles have distinct responsibilities. Objectives (dragons, baron) provide team-wide buffs.`,
    tips: `
- CS is king - 10 CS ≈ 1 kill worth of gold
- Ward river and enemy jungle entrances
- Track enemy jungler to avoid ganks
- Dragon soul spawns after 4 same-type dragons
- Baron buff empowers minions for siege
- Don't chase into fog of war
- Group for objectives, split to create pressure
- Build according to enemy team comp
- Ping missing enemies immediately
- Late game: one death can lose the game
`
  },

  dota2: {
    id: 'dota2',
    name: 'Dota 2',
    icon: '🗡️',
    context: `Dota 2 is a complex MOBA with deep mechanics. Two teams of 5 heroes fight to destroy the Ancient. Denying creeps, pulling camps, and itemization create strategic depth beyond other MOBAs.`,
    tips: `
- Deny your own creeps to starve enemy of XP/gold
- Pull neutral camps to reset lane equilibrium
- TP scrolls are essential - always carry one
- Smoke of Deceit for ganks past ward coverage
- BKB timing is often game-deciding
- Rosh gives Aegis - contest or trade objectives
- Power spikes vary by hero - know your timings
- Buyback is a resource - don't waste it early
- Vision wins games - support should always be warding
- High ground defense is extremely strong
`
  },

  // ============================================================
  // RPG / MMO
  // ============================================================
  elden_ring: {
    id: 'elden_ring',
    name: 'Elden Ring',
    icon: '💀',
    context: `Elden Ring is an open-world action RPG. Players explore the Lands Between, fight challenging bosses, and build characters through stats, weapons, and Ashes of War. Leveling vigor is crucial for survival.`,
    tips: `
- Level Vigor to 40+ before other stats
- Explore thoroughly before tackling main bosses
- Spirit Ashes provide crucial distraction in fights
- Guard counters (block then R2) are very effective
- Learn boss attack patterns - patience over aggression
- Torrent (horse) is essential for open world
- Rune Arcs activate Great Rune bonuses
- Upgrade weapons with smithing stones for damage
- Status effects (bleed, frost, rot) melt bosses
- Summon signs appear near fog walls
`
  },

  wow: {
    id: 'wow',
    name: 'World of Warcraft',
    icon: '⚔️',
    context: `World of Warcraft is an MMORPG. Players level characters, run dungeons and raids, and participate in PvP. Endgame revolves around gear progression through Mythic+ dungeons and raids.`,
    tips: `
- Interrupt casts - it's everyone's job
- Don't stand in bad (ground effects)
- Tank sets pace - let them pull
- Healer mana determines pull speed
- Know your rotation and priority
- Cooldowns should be used, not saved
- Mythic+ affixes change weekly - adapt
- Consumables (food, flasks, pots) matter
- Mechanics > DPS - dead players do 0 damage
- Research fights before attempting them
`
  },

  // ============================================================
  // RACING / SPORTS
  // ============================================================
  rocket_league: {
    id: 'rocket_league',
    name: 'Rocket League',
    icon: '🚀',
    context: `Rocket League is car soccer. Teams score goals using rocket-powered vehicles. Boost management, rotation, and aerial control separate skill levels.`,
    tips: `
- Rotation: first man challenges, second supports, third defends
- Small boost pads give 12 each - grab them constantly
- Don't double commit - one person challenges at a time
- Flip into the ball for power shots
- Aerial training is essential for climbing ranks
- Demo plays can create easy goals
- Shadow defense buys time when retreating
- Half-flip to quickly reverse direction
- Backboard reads for passes and saves
- Fake challenges create hesitation
`
  },

  fifa: {
    id: 'fifa',
    name: 'EA FC / FIFA',
    icon: '⚽',
    context: `EA FC (FIFA) is a football simulation. Players control teams in various modes including Ultimate Team. Skill moves, tactical formations, and timed finishing affect gameplay.`,
    tips: `
- Timed finishing (green) increases shot accuracy
- Don't sprint constantly - controlled dribbling is safer
- Through balls behind the defense are deadly
- Defend with CDMs, not CBs (pull them out of position)
- Formation and tactics matter - adjust to opponent
- Skill moves: ball roll, fake shot, and drag back are essential
- Counter attacks punish aggressive opponents
- Set pieces are free goal opportunities - practice them
- Player work rates affect positioning
- Chemistry styles boost specific stats
`
  },

  // ============================================================
  // STRATEGY
  // ============================================================
  civ6: {
    id: 'civ6',
    name: 'Civilization VI',
    icon: '🏛️',
    context: `Civilization VI is a turn-based strategy game. Players build empires from ancient times to the future, pursuing victory through domination, science, culture, religion, or diplomacy.`,
    tips: `
- Settle your capital on turn 1 unless scouting reveals better
- Builder charges are limited - use wisely
- District placement matters - plan adjacencies
- Science and culture victories need campuses/theater squares
- Early military prevents being conquered
- Trade routes provide gold and spread religion
- Eurekas and inspirations save research time
- City-state suzerainty provides unique bonuses
- Great people can be game-changing
- Diplomatic favor accumulates for World Congress
`
  },

  aoe4: {
    id: 'aoe4',
    name: 'Age of Empires IV',
    icon: '🏰',
    context: `Age of Empires IV is a real-time strategy game. Players gather resources, build armies, and advance through ages to defeat opponents. Each civilization has unique units and bonuses.`,
    tips: `
- Constant villager production is essential
- Scout early to find enemy base and resources
- Build orders optimize your opening
- Counter units: spears beat cavalry, archers beat spears
- Raiding enemy economy slows their progress
- Map control provides sacred sites and relics
- Aging up at the right time balances power and economy
- Walls buy time but aren't invincible
- Siege weapons are necessary to break fortifications
- Micro your units - don't just attack-move
`
  }
};

// Export both the profiles object and an array for UI listing
module.exports = gameProfiles;

// Helper to get array of profiles for dropdowns
module.exports.getProfileList = () => {
  return Object.values(gameProfiles).map(profile => ({
    id: profile.id,
    name: profile.name,
    icon: profile.icon
  }));
};
