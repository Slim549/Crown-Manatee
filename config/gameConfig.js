// CENTRAL RULES. Scoring and tie logic live here, never in the UI.
module.exports = {
  minPlayers: 2,                 // host cannot begin selection below this
  picksRequired: 3,              // areas each player selects
  defaults: {
    gameMinutes: 20,             // shared race clock, chosen when the host opens a game
    questionSeconds: 0,          // unused: only the host's game clock ends the session
    requiredPerNode: 5,          // questions a player must answer at a building before the crown choice
    maxQuestions: 30,            // full bank available to players who keep going
    pointsPerCorrect: 1,         // no negative points
    speedBonus: false,           // default OFF
    tieHandling: 'shared',       // tied building leaders and overall winners share the place
    revealCorrect: true,         // show the correct answer to that player as soon as they lock in
    allowAnswerChange: false,
  },
  // Points for one answer. Change here to add penalties or bonuses.
  scoreAnswer(correct, settings, fractionTimeLeft){
    if(!correct) return 0;
    let p = settings.pointsPerCorrect;
    if(settings.speedBonus) p += settings.pointsPerCorrect*0.5*fractionTimeLeft;
    return Math.round(p*100)/100;
  },
};
