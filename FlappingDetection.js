// opts
//   streamInterval
//   changeInterval
//   states
//     value
//     odds (all states' odds should add up to 1)


/**
 * Testing service for a flapping algorithm.
 * @param {Object} opts 
 *                   states - Various states that can be broadcast
 *                   
 */
function FlappingService(opts) {
  debugger;
  
  var listeners = [],
      changeCounter = 0;
  
  opts.states = spreadOdds(opts.states);
  
  /**
   * Spreads odds of result being broadcast among available options.
   * @param  {Array} states Available states (from opts.states)
   * @return {Object}        States array
   */
  function spreadOdds(states) {
    var total = 1,
        itr = 0;
    // noprotect
    while(total > 0) {
      states[itr].high = total;
      total -= states[itr].odds[changeCounter];
      states[itr].low = total;      
      itr++;
      
      // To catch a case where the total isn't completely 0
      if (itr === states.length && total > 0) {
        states[itr-1].low = total = 0;
      }
    }
    
    return states;
  }
  
  /**
   * Interval that streams out results
   * @param  {[type]} opts.streamInterval [description]
   * @return {[type]}                     [description]
   */
  setInterval(function() {
    var i = 0,
        len = opts.states.length,
        value,
        roll = Math.random(),
        val;
        
    for (; i < len; i++) {
      if (roll >= opts.states[i].low && roll <= opts.states[i].high) {
        val = opts.states[i].value;
        break;
      }
    }
    
    i = 0; len = listeners.length;
    
    for (; i < len; i++) {
      listeners[i].apply(window, [val]);
    }
  }, opts.streamInterval);
  
  /**
   * Cycles through odds of available states.
   * @param  {[type]} opts.changeInterval [description]
   * @return {[type]}                     [description]
   */
  var changeInterval = setInterval(function() {
    changeCounter++;
    if (changeCounter === opts.states[0].odds.length) {
      changeCounter = 0;
    }
    opts.states = spreadOdds(opts.states);    
  }, opts.changeInterval);
      
  return {
    addListener: function(fn) {
      listeners.push(fn);
    }
  };
}

var flapper = new FlappingService({
  streamInterval: 1000, // Broadcasts once a second
  changeInterval: 5000, // cycles through `odds` once every 5 seconds
  states: [{
    value: '1',         // value broadcasted
    odds: [1, 1, 1, 0]  // 100% for 5 sec. 100% for 5 sec, 100% for 5 sec, 0% for 5 sec
  }, {
    value: '0',
    odds: [0, 0, 0, 1]
  }]
});

/**
 * A flapping detection algorithm. Has three states: Good, Bad and Recovery. When
 * a service goes into bad mode, the algorithm averages out the peaks and valleys
 * and "watches" them in a stable "window" of availability (i.e. a service is
 * available 75% of the time and drops at regular intervals, it teases out the
 * fluctuations).
 * 
 * @param {[type]} opts [description]
 */
function FlappingDetection(opts) {
  var stream = [],
      good = true,
      recovery = false,
      goodState = opts.good,
      badState = opts.bad,
      lastRatio,
      windowMargin = 0.02,
      averageRatio = 1,
      nominalRatio = opts.nominalRatio || 0.98,
      settled = false;
  
  /**
   * Ratio of "good" to "bad" announcements
   * @return {Number}
   */
  function determineRatio() {
    var i = 0,
        len = stream.length,
        goodCount = 0;
    
    for (;i < len; i++) {
      if (stream[i] === goodState) {
        goodCount++;
      }
    }
    
    return goodCount/len;
  }
  
  return {
    /**
     * Push an additional state to the flapping algorithm. If you have a service
     * pinging a host, you'll want the result to be sent here.
     * @param {Various} state Can be anything that represents the states of your
     *                        service, so long as they can be type-compared
     */
    addState: function(state) {
      var ratio,
          recoveryThreshold;
      
      stream.push(state);
      ratio = determineRatio();
      ratioLow = lastRatio - windowMargin;
      ratioHigh = lastRatio + windowMargin;

      // Services is in good state
      if (good) {
        if (ratio < nominalRatio) { // Service dipped below viability
          this.goToBadStateMode();
        } else {
          if (stream.length > 100) { // Nothing bad happened
            stream.shift();
            stream.shift(); // Two shifts for cleanup after a recovery state
          }
        }
      } else if (recovery) { // Service is not 100%, but it appears to be recovering
        if (ratio > lastRatio) {
          stream.shift();
        }
        
        if (ratio >= nominalRatio) { // Service appears to have reached nominal status
          averageRatio = nominalRatio;
          this.goToGoodStateMode();
        }
      } else { // Service is in bad mode
        if (ratio === lastRatio) { // test if the ratios have settled
          settled = true;
        } else {
          settled = false;
        }
        
        if (settled) {
          averageRatio = ratio;
        }
        
        if (ratio > lastRatio) { // test if ratio is upward bound
          // A recovery threshold is the average between the average bad ratio and
          // the nominal ratio. If the service's ratio surpasses this amount, it's deemed 
          // "in recovery"
          recoveryThreshold = (nominalRatio - averageRatio)/2 + averageRatio;

          if (ratio > recoveryThreshold) {
            this.goToRecoveryStateMode();
          }
        } 
        
        if (ratio >= ratioLow && ratio <= ratioHigh) { // maintain window length
                                                       // if ratio doesn't change
                                                       // drastically
          stream.shift();
        }         
      }
      
      //console.log('good: ' + good + ', recovery: ' + recovery + ', ratio: ' + ratio + ', lastRatio: ' + lastRatio + ', settled: ' + settled + ', recoveryThreshold: ' + recoveryThreshold + ', averageRatio: ' + averageRatio);      
      
      lastRatio = ratio;
    },
    
    goToBadStateMode: function() {
      good = false;
      recovery = false;
      this.alert('bad');
    },
    
    goToGoodStateMode: function() {
      good = true;
      recovery = false;
      this.alert('good');
    },
    
    goToRecoveryStateMode: function() {
      recovery = true;
      this.alert('recovery');
    },
    
    alert: function(state) {}
  };
}

var flappingDetector = new FlappingDetection({
  good : '1', // Configure with the good and bad states
  bad  : '0'
});

flappingDetector.alert = function(state) {
  console.log(state);
};

flapper.addListener(flappingDetector.addState.bind(flappingDetector));