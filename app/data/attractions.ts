export type AttractionType =
  | 'ride'
  | 'coaster'
  | 'show'
  | 'dining'
  | 'character'
  | 'water'
  | 'walkthrough'

export type Intensity = 'chill' | 'moderate' | 'thrill' | 'extreme'

export interface Attraction {
  id: string
  name: string
  parkId: string
  land: string
  type: AttractionType
  intensity: Intensity
  /** Approximate time to allow on-site, in minutes (queue + experience). */
  durationMin: number
  minHeightIn?: number
  priority: 1 | 2 | 3
  tags: string[]
  note: string
}

/**
 * A hand-picked, opinionated set of Orlando headliners. Not exhaustive —
 * enough to build a realistic itinerary without drowning in options.
 */
export const ATTRACTIONS: Attraction[] = [
  // ---- Magic Kingdom ----
  { id: 'mk-tron', name: 'TRON Lightcycle / Run', parkId: 'mk', land: 'Tomorrowland', type: 'coaster', intensity: 'thrill', durationMin: 45, minHeightIn: 48, priority: 1, tags: ['virtual queue', 'rain-sensitive'], note: 'Join the virtual queue at 7am or buy an Individual Lightning Lane.' },
  { id: 'mk-sdmt', name: 'Seven Dwarfs Mine Train', parkId: 'mk', land: 'Fantasyland', type: 'coaster', intensity: 'moderate', durationMin: 55, minHeightIn: 38, priority: 1, tags: ['family coaster'], note: 'Longest standby line in the park most days — go at rope drop or late.' },
  { id: 'mk-space', name: 'Space Mountain', parkId: 'mk', land: 'Tomorrowland', type: 'coaster', intensity: 'thrill', durationMin: 40, minHeightIn: 44, priority: 2, tags: ['dark', 'indoor'], note: 'Rougher ride; good Lightning Lane pick.' },
  { id: 'mk-pirates', name: 'Pirates of the Caribbean', parkId: 'mk', land: 'Adventureland', type: 'ride', intensity: 'chill', durationMin: 30, priority: 2, tags: ['classic', 'small drop'], note: 'High capacity — line moves fast.' },
  { id: 'mk-haunted', name: 'Haunted Mansion', parkId: 'mk', land: 'Liberty Square', type: 'ride', intensity: 'chill', durationMin: 30, priority: 2, tags: ['classic', 'dark'], note: 'Doom buggies rarely stop loading.' },
  { id: 'mk-jungle', name: 'Jungle Cruise', parkId: 'mk', land: 'Adventureland', type: 'ride', intensity: 'chill', durationMin: 35, priority: 3, tags: ['boat', 'comedy'], note: 'Skipper puns included at no extra charge.' },
  { id: 'mk-fireworks', name: 'Happily Ever After (fireworks)', parkId: 'mk', land: 'Main Street U.S.A.', type: 'show', intensity: 'chill', durationMin: 60, priority: 1, tags: ['evening', 'projection'], note: 'Stake a Main Street spot ~45 min early, or watch from the hub.' },

  // ---- EPCOT ----
  { id: 'ep-guardians', name: 'Guardians of the Galaxy: Cosmic Rewind', parkId: 'epcot', land: 'World Discovery', type: 'coaster', intensity: 'thrill', durationMin: 45, minHeightIn: 42, priority: 1, tags: ['virtual queue'], note: 'Virtual queue drops at 7am & 1pm; otherwise Individual Lightning Lane.' },
  { id: 'ep-frozen', name: 'Frozen Ever After', parkId: 'epcot', land: 'World Showcase – Norway', type: 'ride', intensity: 'chill', durationMin: 45, priority: 2, tags: ['boat', 'family'], note: 'Consistently long; Lightning Lane or first thing.' },
  { id: 'ep-testtrack', name: 'Test Track', parkId: 'epcot', land: 'World Discovery', type: 'ride', intensity: 'thrill', durationMin: 40, minHeightIn: 40, priority: 2, tags: ['fast', 'rain-sensitive'], note: 'Reimagined version — check it has reopened before you rely on it.' },
  { id: 'ep-soarin', name: 'Soarin’ Around the World', parkId: 'epcot', land: 'World Nature', type: 'ride', intensity: 'chill', durationMin: 35, minHeightIn: 40, priority: 2, tags: ['flight simulator'], note: 'Ask for a B-row seat for the best view.' },
  { id: 'ep-ratatouille', name: 'Remy’s Ratatouille Adventure', parkId: 'epcot', land: 'World Showcase – France', type: 'ride', intensity: 'chill', durationMin: 40, priority: 2, tags: ['trackless', '3D'], note: 'No height requirement — great for little ones.' },
  { id: 'ep-worldshowcase', name: 'World Showcase stroll + snacks', parkId: 'epcot', land: 'World Showcase', type: 'dining', intensity: 'chill', durationMin: 120, priority: 3, tags: ['food', 'drinks', 'evening'], note: '“Drink around the world” pace: one snack or sip per pavilion.' },

  // ---- Hollywood Studios ----
  { id: 'hs-rotr', name: 'Star Wars: Rise of the Resistance', parkId: 'hs', land: "Galaxy's Edge", type: 'ride', intensity: 'moderate', durationMin: 60, minHeightIn: 40, priority: 1, tags: ['trackless', 'multi-scene'], note: 'The must-do. Lightning Lane sells out fast — buy at 7am.' },
  { id: 'hs-smugglers', name: 'Millennium Falcon: Smugglers Run', parkId: 'hs', land: "Galaxy's Edge", type: 'ride', intensity: 'moderate', durationMin: 35, minHeightIn: 38, priority: 2, tags: ['interactive', 'cockpit'], note: 'Ask to be a pilot; try not to crash the Falcon.' },
  { id: 'hs-slinky', name: 'Slinky Dog Dash', parkId: 'hs', land: 'Toy Story Land', type: 'coaster', intensity: 'moderate', durationMin: 50, minHeightIn: 38, priority: 1, tags: ['family coaster', 'outdoor'], note: 'Rope drop or last hour; brutal midday.' },
  { id: 'hs-tot', name: 'The Twilight Zone Tower of Terror', parkId: 'hs', land: 'Sunset Boulevard', type: 'ride', intensity: 'thrill', durationMin: 40, minHeightIn: 40, priority: 2, tags: ['drop', 'themed'], note: 'Randomised drop sequence — every ride is different.' },
  { id: 'hs-rrc', name: 'Rock ’n’ Roller Coaster', parkId: 'hs', land: 'Sunset Boulevard', type: 'coaster', intensity: 'thrill', durationMin: 40, minHeightIn: 48, priority: 3, tags: ['launch', 'indoor', 'loops'], note: '0–57 mph launch; frequent refurb closures.' },
  { id: 'hs-fantasmic', name: 'Fantasmic!', parkId: 'hs', land: 'Sunset Boulevard', type: 'show', intensity: 'chill', durationMin: 75, priority: 2, tags: ['evening', 'water', 'seating'], note: 'Arrive 45–60 min early or reserve a dining package.' },

  // ---- Animal Kingdom ----
  { id: 'ak-fop', name: 'Avatar Flight of Passage', parkId: 'ak', land: 'Pandora', type: 'ride', intensity: 'thrill', durationMin: 60, minHeightIn: 44, priority: 1, tags: ['3D', 'motion'], note: 'Best ride at Disney World for many. Rope drop Pandora immediately.' },
  { id: 'ak-navi', name: 'Na’vi River Journey', parkId: 'ak', land: 'Pandora', type: 'ride', intensity: 'chill', durationMin: 45, priority: 3, tags: ['boat', 'slow'], note: 'Beautiful but short; skip if the wait is over 45 min.' },
  { id: 'ak-safari', name: 'Kilimanjaro Safaris', parkId: 'ak', land: 'Africa', type: 'ride', intensity: 'chill', durationMin: 40, priority: 1, tags: ['animals', 'outdoor', 'morning'], note: 'Animals are most active early and near dusk.' },
  { id: 'ak-everest', name: 'Expedition Everest', parkId: 'ak', land: 'Asia', type: 'coaster', intensity: 'thrill', durationMin: 35, minHeightIn: 44, priority: 2, tags: ['backwards section', 'yeti'], note: 'Single-rider line is usually a walk-on.' },
  { id: 'ak-kali', name: 'Kali River Rapids', parkId: 'ak', land: 'Asia', type: 'water', intensity: 'moderate', durationMin: 30, minHeightIn: 38, priority: 3, tags: ['get soaked'], note: 'You will get wet. Bring a poncho or do it last.' },
  { id: 'ak-flights', name: 'Feathered Friends in Flight!', parkId: 'ak', land: 'Asia', type: 'show', intensity: 'chill', durationMin: 30, priority: 3, tags: ['animals', 'seated', 'shade'], note: 'A cool, shaded break in the middle of the day.' },

  // ---- Universal Studios Florida ----
  { id: 'usf-escape', name: 'Harry Potter and the Escape from Gringotts', parkId: 'usf', land: 'Diagon Alley', type: 'coaster', intensity: 'moderate', durationMin: 55, minHeightIn: 42, priority: 1, tags: ['3D', 'indoor', 'story'], note: 'Ride the Hogwarts Express between parks at least once.' },
  { id: 'usf-bourne', name: 'The Bourne Stuntacular', parkId: 'usf', land: 'Hollywood', type: 'show', intensity: 'chill', durationMin: 35, priority: 2, tags: ['stunt', 'seated', 'AC'], note: 'Genuinely impressive live-plus-screen stunt show.' },
  { id: 'usf-mummy', name: 'Revenge of the Mummy', parkId: 'usf', land: 'New York', type: 'coaster', intensity: 'thrill', durationMin: 35, minHeightIn: 48, priority: 2, tags: ['launch', 'dark', 'indoor'], note: 'Short but punchy indoor coaster.' },
  { id: 'usf-simpsons', name: 'The Simpsons Ride', parkId: 'usf', land: 'Springfield', type: 'ride', intensity: 'moderate', durationMin: 35, minHeightIn: 40, priority: 3, tags: ['simulator', 'screens'], note: 'Grab a Krusty Burger or a Lard Lad donut next door.' },
  { id: 'usf-villain', name: 'Villain-Con Minion Blast', parkId: 'usf', land: 'Minion Land', type: 'ride', intensity: 'chill', durationMin: 30, priority: 3, tags: ['interactive', 'shooter'], note: 'Walk-through blaster game; low-commitment fun.' },

  // ---- Islands of Adventure ----
  { id: 'ioa-hagrid', name: "Hagrid's Magical Creatures Motorbike Adventure", parkId: 'ioa', land: 'Hogsmeade', type: 'coaster', intensity: 'thrill', durationMin: 75, minHeightIn: 48, priority: 1, tags: ['story coaster', 'launches'], note: 'The best coaster in Orlando. Rope drop or expect 60–120 min.' },
  { id: 'ioa-velocicoaster', name: 'Jurassic World VelociCoaster', parkId: 'ioa', land: 'Jurassic Park', type: 'coaster', intensity: 'extreme', durationMin: 55, minHeightIn: 51, priority: 1, tags: ['airtime', 'inversions', 'launch'], note: 'Two launches, 70 mph, a near-vertical stall. Single rider helps.' },
  { id: 'ioa-forbidden', name: 'Harry Potter and the Forbidden Journey', parkId: 'ioa', land: 'Hogsmeade', type: 'ride', intensity: 'moderate', durationMin: 45, minHeightIn: 48, priority: 2, tags: ['robocoaster', 'indoor'], note: 'Recently updated; the castle queue is a highlight on its own.' },
  { id: 'ioa-hulk', name: 'The Incredible Hulk Coaster', parkId: 'ioa', land: 'Marvel Super Hero Island', type: 'coaster', intensity: 'extreme', durationMin: 40, minHeightIn: 54, priority: 2, tags: ['launch', 'inversions'], note: 'Use lockers — loose items are a no.' },
  { id: 'ioa-spiderman', name: 'The Amazing Adventures of Spider-Man', parkId: 'ioa', land: 'Marvel Super Hero Island', type: 'ride', intensity: 'moderate', durationMin: 35, priority: 2, tags: ['3D', 'motion', 'classic'], note: 'Still one of the best screen-based dark rides anywhere.' },
  { id: 'ioa-fjourney', name: 'Skull Island: Reign of Kong', parkId: 'ioa', land: 'Skull Island', type: 'ride', intensity: 'moderate', durationMin: 35, minHeightIn: 36, priority: 3, tags: ['trackless-ish', 'screens'], note: 'Sit on the left for the best Kong reveal.' },

  // ---- Epic Universe ----
  { id: 'eu-mariokart', name: 'Mario Kart: Bowser’s Challenge', parkId: 'eu', land: 'Super Nintendo World', type: 'ride', intensity: 'moderate', durationMin: 60, minHeightIn: 40, priority: 1, tags: ['AR', 'interactive'], note: 'Get a Power-Up Band to play the land while you queue.' },
  { id: 'eu-yoshi', name: 'Yoshi’s Adventure', parkId: 'eu', land: 'Super Nintendo World', type: 'ride', intensity: 'chill', durationMin: 35, priority: 3, tags: ['family', 'outdoor', 'views'], note: 'Gentle ride with a nice overview of the land.' },
  { id: 'eu-hiccup', name: 'Hiccup’s Wing Gliders', parkId: 'eu', land: 'How to Train Your Dragon – Isle of Berk', type: 'coaster', intensity: 'thrill', durationMin: 55, minHeightIn: 48, priority: 1, tags: ['launch', 'family thrill'], note: 'Family launch coaster; huge crowds early in the day.' },
  { id: 'eu-monsters', name: 'Monsters Unchained: The Bride’s Revenge', parkId: 'eu', land: 'Dark Universe', type: 'ride', intensity: 'thrill', durationMin: 50, minHeightIn: 48, priority: 2, tags: ['dark ride', 'intense'], note: 'Genuinely scary — not for younger kids.' },
  { id: 'eu-stardust', name: 'Stardust Racers', parkId: 'eu', land: 'Celestial Park', type: 'coaster', intensity: 'extreme', durationMin: 45, minHeightIn: 54, priority: 1, tags: ['dueling', 'launch', 'airtime'], note: 'Dueling launch coaster — try to ride both sides.' },
  { id: 'eu-constellation', name: 'Constellation Carousel', parkId: 'eu', land: 'Celestial Park', type: 'ride', intensity: 'chill', durationMin: 20, priority: 3, tags: ['carousel', 'all ages'], note: 'A calm palate-cleanser between headliners.' },

  // ---- Volcano Bay ----
  { id: 'vb-krakatau', name: 'Krakatau Aqua Coaster', parkId: 'volcano', land: 'Volcano Bay', type: 'water', intensity: 'thrill', durationMin: 45, minHeightIn: 42, priority: 1, tags: ['water coaster', 'uphill blasts'], note: 'The signature slide — TapuTapu virtual line fills fast.' },
  { id: 'vb-kopiko', name: 'Kopiko Wai Winding River', parkId: 'volcano', land: 'Volcano Bay', type: 'water', intensity: 'chill', durationMin: 40, priority: 3, tags: ['lazy river', 'caves'], note: 'Grab a tube and float through the volcano.' },
  { id: 'vb-honu', name: 'Honu ika Moana', parkId: 'volcano', land: 'Volcano Bay', type: 'water', intensity: 'thrill', durationMin: 40, minHeightIn: 48, priority: 2, tags: ['raft', 'wall slide'], note: 'Multi-person raft; Honu side is the wilder of the two.' },

  // ---- SeaWorld ----
  { id: 'sw-pipeline', name: 'Pipeline: The Surf Coaster', parkId: 'seaworld', land: 'SeaWorld Orlando', type: 'coaster', intensity: 'extreme', durationMin: 45, minHeightIn: 54, priority: 1, tags: ['stand-up', 'surf'], note: 'World’s first “surf” coaster — you stand and the seats pump.' },
  { id: 'sw-mako', name: 'Mako', parkId: 'seaworld', land: 'SeaWorld Orlando', type: 'coaster', intensity: 'extreme', durationMin: 35, minHeightIn: 54, priority: 1, tags: ['hypercoaster', 'airtime'], note: '73 mph of floaty airtime hills — Orlando’s tallest and fastest.' },
  { id: 'sw-manta', name: 'Manta', parkId: 'seaworld', land: 'SeaWorld Orlando', type: 'coaster', intensity: 'thrill', durationMin: 35, minHeightIn: 54, priority: 2, tags: ['flying coaster'], note: 'Fly face-down past a ray-filled aquarium queue.' },
  { id: 'sw-dolphin', name: 'Dolphin Adventures show', parkId: 'seaworld', land: 'SeaWorld Orlando', type: 'show', intensity: 'chill', durationMin: 40, priority: 3, tags: ['animals', 'seated', 'schedule'], note: 'Check the day’s showtimes when you enter and plan around them.' },
]

export const ATTRACTION_BY_ID: Record<string, Attraction> = Object.fromEntries(
  ATTRACTIONS.map((a) => [a.id, a]),
)

export const TYPE_LABEL: Record<AttractionType, string> = {
  ride: 'Ride',
  coaster: 'Coaster',
  show: 'Show',
  dining: 'Food & drink',
  character: 'Characters',
  water: 'Water',
  walkthrough: 'Walk-through',
}

export const INTENSITY_LABEL: Record<Intensity, string> = {
  chill: 'Chill',
  moderate: 'Moderate',
  thrill: 'Thrill',
  extreme: 'Extreme',
}
