export interface PackingSeedItem {
  label: string
  category: string
  /** Pre-checked defaults for things most people already carry. */
  done?: boolean
}

/**
 * Starter packing list tuned for an Orlando parks trip: hot, humid, long days
 * on your feet with frequent afternoon thunderstorms.
 */
export const PACKING_TEMPLATE: PackingSeedItem[] = [
  // Park bag
  { label: 'Refillable water bottle', category: 'Park bag' },
  { label: 'Portable phone battery + cable', category: 'Park bag' },
  { label: 'Compact poncho (one per person)', category: 'Park bag' },
  { label: 'Sunscreen SPF 50', category: 'Park bag' },
  { label: 'Sunglasses', category: 'Park bag' },
  { label: 'Refillable hand sanitiser', category: 'Park bag' },
  { label: 'Small first-aid kit + blister plasters', category: 'Park bag' },
  { label: 'Zip bag for phones on water rides', category: 'Park bag' },
  { label: 'Portable fan / misting fan', category: 'Park bag' },

  // Clothing
  { label: 'Broken-in walking shoes', category: 'Clothing' },
  { label: 'Second pair of shoes to rotate', category: 'Clothing' },
  { label: 'Moisture-wicking socks (1 per day)', category: 'Clothing' },
  { label: 'Light rain jacket', category: 'Clothing' },
  { label: 'Swimwear + quick-dry towel', category: 'Clothing' },
  { label: 'Hat or cap', category: 'Clothing' },
  { label: 'Evening layer for cooler nights', category: 'Clothing' },

  // Documents & money
  { label: 'Photo ID / passports', category: 'Documents & money' },
  { label: 'Park tickets linked in the app', category: 'Documents & money' },
  { label: 'Hotel confirmation', category: 'Documents & money' },
  { label: 'Credit card + some cash', category: 'Documents & money' },
  { label: 'Travel insurance details', category: 'Documents & money' },
  { label: 'Magic Band / Universal ticket', category: 'Documents & money' },

  // Health
  { label: 'Daily medications', category: 'Health' },
  { label: 'Pain reliever / antacids', category: 'Health' },
  { label: 'Anti-chafe balm', category: 'Health' },
  { label: 'Electrolyte tablets', category: 'Health' },
  { label: 'Aloe vera gel', category: 'Health' },

  // Tech
  { label: 'Phone charger for the room', category: 'Tech', done: true },
  { label: 'Camera + spare battery', category: 'Tech' },
  { label: 'UK→US plug adapters', category: 'Tech' },
  { label: 'Headphones', category: 'Tech', done: true },

  // Kids (delete if not needed)
  { label: 'Stroller or stroller rental booked', category: 'Kids' },
  { label: 'Snacks for queues', category: 'Kids' },
  { label: 'Autograph book + fat pen', category: 'Kids' },
  { label: 'Comfort item / small toy', category: 'Kids' },
]
