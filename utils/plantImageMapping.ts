// Classic plant image mapping based on km distance requirements
// Images are stored as 1.png, 2.png, etc. in assets/images/plants/classic/

export const CLASSIC_PLANT_IMAGES: { [key: string]: any } = {
  '1': require('../assets/images/plants/classic/1.png'),
  '2': require('../assets/images/plants/classic/2.png'),
  '3': require('../assets/images/plants/classic/3.png'),
  '4': require('../assets/images/plants/classic/4.png'),
  '5': require('../assets/images/plants/classic/5.png'),
  '6': require('../assets/images/plants/classic/6.png'),
  '7': require('../assets/images/plants/classic/7.png'),
  '8': require('../assets/images/plants/classic/8.png'),
  '9': require('../assets/images/plants/classic/9.png'),
  '10': require('../assets/images/plants/classic/10.png'),
  '11': require('../assets/images/plants/classic/11.png'),
  '12': require('../assets/images/plants/classic/12.png'),
  '13': require('../assets/images/plants/classic/13.png'),
  '14': require('../assets/images/plants/classic/14.png'),
  '15': require('../assets/images/plants/classic/15.png'),
  '16': require('../assets/images/plants/classic/16.png'),
  '17': require('../assets/images/plants/classic/17.png'),
  '18': require('../assets/images/plants/classic/18.png'),
  '19': require('../assets/images/plants/classic/19.png'),
  '20': require('../assets/images/plants/classic/20.png'),
  '21': require('../assets/images/plants/classic/21.png'),
  '22': require('../assets/images/plants/classic/22.png'),
  '23': require('../assets/images/plants/classic/23.png'),
  '24': require('../assets/images/plants/classic/24.png'),
  '25': require('../assets/images/plants/classic/25.png'),
  '26': require('../assets/images/plants/classic/26.png'),
  '27': require('../assets/images/plants/classic/27.png'),
  '28': require('../assets/images/plants/classic/28.png'),
  '29': require('../assets/images/plants/classic/29.png'),
  '30': require('../assets/images/plants/classic/30.png'),
  '31': require('../assets/images/plants/classic/31.png'),
  '32': require('../assets/images/plants/classic/32.png'),
  '33': require('../assets/images/plants/classic/33.png'),
  '34': require('../assets/images/plants/classic/34.png'),
  '35': require('../assets/images/plants/classic/35.png'),
  '36': require('../assets/images/plants/classic/36.png'),
  '37': require('../assets/images/plants/classic/37.png'),
  '38': require('../assets/images/plants/classic/38.png'),
  '39': require('../assets/images/plants/classic/39.png'),
  '40': require('../assets/images/plants/classic/40.png'),
  '41': require('../assets/images/plants/classic/41.png'),
  '42': require('../assets/images/plants/classic/42.png'),
  '43': require('../assets/images/plants/classic/43.png'),
  '44': require('../assets/images/plants/classic/44.png'),
  '45': require('../assets/images/plants/classic/45.png'),
  '46': require('../assets/images/plants/classic/46.png'),
  '47': require('../assets/images/plants/classic/47.png'),
  '48': require('../assets/images/plants/classic/48.png'),
  '49': require('../assets/images/plants/classic/49.png'),
  '50': require('../assets/images/plants/classic/50.png'),
  '51': require('../assets/images/plants/classic/51.png'),
  '52': require('../assets/images/plants/classic/52.png'),
  '53': require('../assets/images/plants/classic/53.png'),
  '54': require('../assets/images/plants/classic/54.png'),
  '55': require('../assets/images/plants/classic/55.png'),
  '56': require('../assets/images/plants/classic/56.png'),
  '57': require('../assets/images/plants/classic/57.png'),
  '58': require('../assets/images/plants/classic/58.png'),
  '59': require('../assets/images/plants/classic/59.png'),
  '60': require('../assets/images/plants/classic/60.png'),
  '61': require('../assets/images/plants/classic/61.png'),
  '62': require('../assets/images/plants/classic/62.png'),
  '63': require('../assets/images/plants/classic/63.png'),
  '64': require('../assets/images/plants/classic/64.png'),
  '65': require('../assets/images/plants/classic/65.png'),
  '66': require('../assets/images/plants/classic/66.png'),
  '67': require('../assets/images/plants/classic/67.png'),
  '68': require('../assets/images/plants/classic/68.png'),
  '69': require('../assets/images/plants/classic/69.png'),
  '70': require('../assets/images/plants/classic/70.png'),
  '71': require('../assets/images/plants/classic/71.png'),
  '72': require('../assets/images/plants/classic/72.png'),
  '73': require('../assets/images/plants/classic/73.png'),
  '74': require('../assets/images/plants/classic/74.png'),
  '75': require('../assets/images/plants/classic/75.png'),
  '76': require('../assets/images/plants/classic/76.png'),
  '77': require('../assets/images/plants/classic/77.png'),
  '78': require('../assets/images/plants/classic/78.png'),
  '79': require('../assets/images/plants/classic/79.png'),
  '80': require('../assets/images/plants/classic/80.png'),
  '81': require('../assets/images/plants/classic/81.png'),
  '82': require('../assets/images/plants/classic/82.png'),
  '83': require('../assets/images/plants/classic/83.png'),
  '84': require('../assets/images/plants/classic/84.png'),
  '85': require('../assets/images/plants/classic/85.png'),
  '86': require('../assets/images/plants/classic/86.png'),
  '87': require('../assets/images/plants/classic/87.png'),
  '88': require('../assets/images/plants/classic/88.png'),
  '89': require('../assets/images/plants/classic/89.png'),
  '90': require('../assets/images/plants/classic/90.png'),
  '91': require('../assets/images/plants/classic/91.png'),
  '92': require('../assets/images/plants/classic/92.png'),
  '93': require('../assets/images/plants/classic/93.png'),
  '94': require('../assets/images/plants/classic/94.png'),
  '95': require('../assets/images/plants/classic/95.png'),
  '96': require('../assets/images/plants/classic/96.png'),
  '97': require('../assets/images/plants/classic/97.png'),
  '98': require('../assets/images/plants/classic/98.png'),
  '99': require('../assets/images/plants/classic/99.png'),
  '100': require('../assets/images/plants/classic/100.png'),
};

// Helper function to get classic plant image by km distance
export const getClassicPlantImage = (kmDistance: number): any => {
  const key = kmDistance.toString();
  return CLASSIC_PLANT_IMAGES[key] || require('../assets/images/plants/dandelion.png');
};

// Helper function to get image source from plant type distance requirement
export const getPlantImageFromDistance = (distanceInMeters: number): any => {
  const kmDistance = Math.floor(distanceInMeters / 1000);
  return getClassicPlantImage(kmDistance);
};

// Updated image source getter that works with existing imagePath system
export const getImageSource = (imagePath: string | null | undefined, distanceRequired?: number): any => {
  // If no imagePath provided but we have distance, generate classic path
  if (!imagePath && distanceRequired) {
    const kmDistance = Math.floor(distanceRequired / 1000);
    if (kmDistance >= 1 && kmDistance <= 100) {
      return getClassicPlantImage(kmDistance);
    }
  }

  if (!imagePath) return require('../assets/images/plants/dandelion.png');

  // Check if it's a classic plant path (contains km distance)
  const classicMatch = imagePath.match(/classic\/(\d+)\.png$/);
  if (classicMatch) {
    const kmDistance = parseInt(classicMatch[1]);
    return getClassicPlantImage(kmDistance);
  }

  // Fallback to existing mapping for legacy paths
  const imageMap: { [key: string]: any } = {
    'assets/images/plants/01.png': require('../assets/images/plants/01.png'),
    'assets/images/plants/carrot.png': require('../assets/images/plants/carrot.png'),
    'assets/images/plants/sakura.png': require('../assets/images/plants/sakura.png'),
    'assets/images/plants/dandelion.png': require('../assets/images/plants/dandelion.png'),
    'assets/images/plants/locked.png': require('../assets/images/plants/locked.png'),
  };

  return imageMap[imagePath] || require('../assets/images/plants/dandelion.png');
};

// Function to generate the classic image path for a given km distance
export const getClassicImagePath = (kmDistance: number): string => {
  return `assets/images/plants/classic/${kmDistance}.png`;
};

// Complete mapping of all plant types with their classic image paths
export const PLANT_TYPE_TO_CLASSIC_IMAGE = {
  // Hero plants at major milestones
  5: { name: "Rose", path: getClassicImagePath(5) },
  10: { name: "Apple Tree", path: getClassicImagePath(10) },
  21: { name: "Sakura", path: getClassicImagePath(21) },
  42: { name: "Baobab", path: getClassicImagePath(42) },
  100: { name: "Golden Truffle", path: getClassicImagePath(100) },
  
  // Flowers (1-4, 6-9km)
  1: { name: "Daisy", path: getClassicImagePath(1) },
  2: { name: "Dandelion", path: getClassicImagePath(2) },
  3: { name: "Marigold", path: getClassicImagePath(3) },
  4: { name: "Bluebell", path: getClassicImagePath(4) },
  6: { name: "Money Plant", path: getClassicImagePath(6) },
  7: { name: "Cornflower", path: getClassicImagePath(7) },
  8: { name: "Poppy", path: getClassicImagePath(8) },
  9: { name: "Aloe Vera", path: getClassicImagePath(9) },
  
  // Bushes and Trees mixed (11-20km)
  11: { name: "Lavender Bush", path: getClassicImagePath(11) },
  12: { name: "Olive Tree", path: getClassicImagePath(12) },
  13: { name: "Camellia", path: getClassicImagePath(13) },
  14: { name: "Birch", path: getClassicImagePath(14) },
  15: { name: "Rosemary", path: getClassicImagePath(15) },
  16: { name: "Pine", path: getClassicImagePath(16) },
  17: { name: "Hydrangea", path: getClassicImagePath(17) },
  18: { name: "Willow", path: getClassicImagePath(18) },
  19: { name: "Oleander", path: getClassicImagePath(19) },
  20: { name: "Maple", path: getClassicImagePath(20) },
  
  // Trees (22-41km, excluding hero plants)
  22: { name: "Elm", path: getClassicImagePath(22) },
  23: { name: "Eucalyptus", path: getClassicImagePath(23) },
  24: { name: "Cypress", path: getClassicImagePath(24) },
  25: { name: "Jacaranda", path: getClassicImagePath(25) },
  26: { name: "Acacia", path: getClassicImagePath(26) },
  27: { name: "Ash", path: getClassicImagePath(27) },
  28: { name: "Ginkgo", path: getClassicImagePath(28) },
  29: { name: "Magnolia", path: getClassicImagePath(29) },
  30: { name: "Cedar", path: getClassicImagePath(30) },
  31: { name: "Chestnut", path: getClassicImagePath(31) },
  32: { name: "Linden", path: getClassicImagePath(32) },
  33: { name: "Hornbeam", path: getClassicImagePath(33) },
  34: { name: "Redwood Sapling", path: getClassicImagePath(34) },
  35: { name: "Oak", path: getClassicImagePath(35) },
  36: { name: "Sequoia Sapling", path: getClassicImagePath(36) },
  37: { name: "Boxwood", path: getClassicImagePath(37) },
  38: { name: "Azalea", path: getClassicImagePath(38) },
  39: { name: "Hibiscus", path: getClassicImagePath(39) },
  40: { name: "Holly", path: getClassicImagePath(40) },
  41: { name: "Tea Bush", path: getClassicImagePath(41) },
  
  // Desert plants (43-69km)
  43: { name: "Prickly Pear", path: getClassicImagePath(43) },
  44: { name: "Aloe", path: getClassicImagePath(44) },
  45: { name: "Agave", path: getClassicImagePath(45) },
  46: { name: "Barrel Cactus", path: getClassicImagePath(46) },
  47: { name: "Cholla", path: getClassicImagePath(47) },
  48: { name: "Organ Pipe", path: getClassicImagePath(48) },
  49: { name: "Ocotillo", path: getClassicImagePath(49) },
  50: { name: "Saguaro", path: getClassicImagePath(50) },
  51: { name: "Yucca", path: getClassicImagePath(51) },
  52: { name: "Desert Marigold", path: getClassicImagePath(52) },
  53: { name: "Tumbleweed", path: getClassicImagePath(53) },
  54: { name: "Mesquite", path: getClassicImagePath(54) },
  55: { name: "Saltbush", path: getClassicImagePath(55) },
  56: { name: "Creosote", path: getClassicImagePath(56) },
  57: { name: "Fairy Duster", path: getClassicImagePath(57) },
  58: { name: "Palo Verde", path: getClassicImagePath(58) },
  59: { name: "Desert Willow", path: getClassicImagePath(59) },
  60: { name: "Joshua Tree", path: getClassicImagePath(60) },
  61: { name: "Fishhook Cactus", path: getClassicImagePath(61) },
  62: { name: "Sand Verbena", path: getClassicImagePath(62) },
  63: { name: "Ghost Plant", path: getClassicImagePath(63) },
  64: { name: "Stonecrop", path: getClassicImagePath(64) },
  65: { name: "Queen of the Night", path: getClassicImagePath(65) },
  66: { name: "Elephant Bush", path: getClassicImagePath(66) },
  67: { name: "Hedgehog Cactus", path: getClassicImagePath(67) },
  68: { name: "Living Stones", path: getClassicImagePath(68) },
  69: { name: "Golden Barrel", path: getClassicImagePath(69) },
  
  // Mushrooms (70-99km)
  70: { name: "Morel", path: getClassicImagePath(70) },
  71: { name: "Porcini", path: getClassicImagePath(71) },
  72: { name: "Chanterelle", path: getClassicImagePath(72) },
  73: { name: "Oyster", path: getClassicImagePath(73) },
  74: { name: "Shiitake", path: getClassicImagePath(74) },
  75: { name: "Enoki", path: getClassicImagePath(75) },
  76: { name: "Shimeji", path: getClassicImagePath(76) },
  77: { name: "King Trumpet", path: getClassicImagePath(77) },
  78: { name: "Maitake", path: getClassicImagePath(78) },
  79: { name: "Lion's Mane", path: getClassicImagePath(79) },
  80: { name: "Black Trumpet", path: getClassicImagePath(80) },
  81: { name: "Coral Fungus", path: getClassicImagePath(81) },
  82: { name: "Turkey Tail", path: getClassicImagePath(82) },
  83: { name: "Ink Cap", path: getClassicImagePath(83) },
  84: { name: "Puffball", path: getClassicImagePath(84) },
  85: { name: "Hedgehog", path: getClassicImagePath(85) },
  86: { name: "Cauliflower Fungus", path: getClassicImagePath(86) },
  87: { name: "Milkcap", path: getClassicImagePath(87) },
  88: { name: "Russula", path: getClassicImagePath(88) },
  89: { name: "Boletus", path: getClassicImagePath(89) },
  90: { name: "Amethyst Deceiver", path: getClassicImagePath(90) },
  91: { name: "Velvet Foot", path: getClassicImagePath(91) },
  92: { name: "Fairy Ring", path: getClassicImagePath(92) },
  93: { name: "Witch's Butter", path: getClassicImagePath(93) },
  94: { name: "Earthstar", path: getClassicImagePath(94) },
  95: { name: "Fly Agaric", path: getClassicImagePath(95) },
  96: { name: "Blewit", path: getClassicImagePath(96) },
  97: { name: "Parasol", path: getClassicImagePath(97) },
  98: { name: "Stinkhorn", path: getClassicImagePath(98) },
  99: { name: "Mycelium Cluster", path: getClassicImagePath(99) },
} as const;
