// Asset map and board geometry. Coordinates are the 2000×1545 design canvas.
// Building and crown files in /assets/processed are repaired copies. Originals stay in /assets/buildings and /assets/ui.
export const BOARD = {
  w: 1999,
  h: 1545,
  designW: 2000,
  designH: 1545,
  image: '/assets/board/board-empty.png',
};
export const CROWN = '/assets/processed/ui/crown.png';

// star = where nameplates gather. tags = direction the stack grows.
// box = [x, y, w, h] of the building sprite. label = [centerX, top, width].
export const NODE_ART = {
  'judicial-center':    { tags: 'right', img: '01_courthouse_building_cluster.png',       box: [102, 96, 657, 371],    star: [524, 482],   label: [604, 73, 330] },
  'elections':          { tags: 'below', img: '03_supervisor_of_elections_building.png',  box: [823, 274, 568, 161],   star: [1294, 480],  label: [1110, 187, 500] },
  'gt-bray':            { tags: 'left',  img: '02_tennis_and_recreation_facility.png',    box: [1437, 151, 518, 318],  star: [1733, 515],  label: [1612, 57, 340] },
  'school-district':    { tags: 'right', img: '05_modern_civic_building.png',             box: [42, 601, 461, 336],    star: [519, 820],   label: [303, 527, 580] },
  'sheriff':            { tags: 'right', img: '04_sheriffs_office_operations_center.png', box: [684, 560, 477, 235],   star: [927, 845],   label: [910, 506, 560] },
  'county-admin':       { tags: 'below', img: '06_manatee_county_government_building.png',box: [1372, 687, 601, 315], star: [1779, 1044], label: [1641, 604, 420] },
  'library':            { tags: 'below', img: '07_library.png',                           box: [412, 993, 443, 186],   star: [815, 1185],  label: [683, 946, 640] },
  'property-appraiser': { tags: 'left',  img: '08_property_appraiser_building.png',       box: [1004, 1071, 548, 206], star: [1331, 1295], label: [1250, 1003, 470] },
  'animal-welfare':     { tags: 'above', img: '10_humane_society_building.png',           box: [99, 1255, 521, 178],   star: [665, 1365],  label: [342, 1222, 580] },
  'public-works':       { tags: 'above', img: '09_water_pipe.png',                        box: [1503, 1233, 492, 192], star: [1889, 1476], label: [1558, 1477, 560] },
};

export const HOME = { x: 40, y: 1410, cols: 4, dx: 245, dy: 72 };
export const TAG = { w: 230, h: 64 };

export function buildingSrc(id) {
  return '/assets/processed/buildings/' + NODE_ART[id].img;
}

export const AUDIO = {
  hostMusic: '/assets/audio/host-game.mp3',
  introMusic: '/assets/audio/intro.mp3',
  gameMusic: '/assets/audio/game.mp3',
  tick: '/assets/audio/tick.mp3',
  finalWarning: '/assets/audio/warning.mp3',
  submitted: '/assets/audio/submit.mp3',
  correct: '/assets/audio/correct.mp3',
  incorrect: '/assets/audio/incorrect.mp3',
  buildingActive: '/assets/audio/building.mp3',
  tagMove: '/assets/audio/move.mp3',
  crown: '/assets/audio/crown-ding.mp3',
  roundComplete: '/assets/audio/round.mp3',
  celebration: '/assets/audio/win.mp3',
  victory: '/assets/audio/victory.mp3',
};
