(function(/*! Brunch !*/) {
  'use strict';

  var globals = typeof window !== 'undefined' ? window : global;
  if (typeof globals.require === 'function') return;

  var modules = {};
  var cache = {};

  var has = function(object, name) {
    return ({}).hasOwnProperty.call(object, name);
  };

  var expand = function(root, name) {
    var results = [], parts, part;
    if (/^\.\.?(\/|$)/.test(name)) {
      parts = [root, name].join('/').split('/');
    } else {
      parts = name.split('/');
    }
    for (var i = 0, length = parts.length; i < length; i++) {
      part = parts[i];
      if (part === '..') {
        results.pop();
      } else if (part !== '.' && part !== '') {
        results.push(part);
      }
    }
    return results.join('/');
  };

  var dirname = function(path) {
    return path.split('/').slice(0, -1).join('/');
  };

  var localRequire = function(path) {
    return function(name) {
      var dir = dirname(path);
      var absolute = expand(dir, name);
      return globals.require(absolute, path);
    };
  };

  var initModule = function(name, definition) {
    var module = {id: name, exports: {}};
    definition(module.exports, localRequire(name), module);
    var exports = cache[name] = module.exports;
    return exports;
  };

  var require = function(name, loaderPath) {
    var path = expand(name, '.');
    if (loaderPath == null) loaderPath = '/';

    if (has(cache, path)) return cache[path];
    if (has(modules, path)) return initModule(path, modules[path]);

    var dirIndex = expand(path, './index');
    if (has(cache, dirIndex)) return cache[dirIndex];
    if (has(modules, dirIndex)) return initModule(dirIndex, modules[dirIndex]);

    throw new Error('Cannot find module "' + name + '" from '+ '"' + loaderPath + '"');
  };

  var define = function(bundle, fn) {
    if (typeof bundle === 'object') {
      for (var key in bundle) {
        if (has(bundle, key)) {
          modules[key] = bundle[key];
        }
      }
    } else {
      modules[bundle] = fn;
    }
  };

  var list = function() {
    var result = [];
    for (var item in modules) {
      if (has(modules, item)) {
        result.push(item);
      }
    }
    return result;
  };

  globals.require = require;
  globals.require.define = define;
  globals.require.register = define;
  globals.require.list = list;
  globals.require.brunch = true;
})();
require.register("app", function(exports, require, module) {
module.exports = Em.Application.create();

});

require.register("controllers/channel", function(exports, require, module) {
var App = require('app');

App.ChannelController = Em.ObjectController.extend({
  init: function() {
    this._super();
    App.pubsub.subscribe('tick', this, this.onTick);
  },
  willDestroy: function() {
    this._super();
    App.pubsub.unsubscribe('tick', this, this.onTick);
  },
  class: function() {
    return "channel  " + this.get('sound');
  }.property('sound'),

  playStep: function(step) {
    this.playSound(step.get('velocity'));
  },
  playSound: function(velocity) {
    if(velocity === undefined) {
      velocity = 1;
    }
    App.pubsub.publish('sound', {
      sound: this.get('sound'),
      velocity: velocity * this.get('volume'),
      pan: this.get('pan')
    });
  },
  onTick: function(tick) {
    var currentStepIndex = (tick-1) % this.get('stepCount');

    var steps = this.get('steps');
    steps.setEach('active', false);

    var step = steps.objectAt(currentStepIndex);
    step.set('active', true);

    if(step.get('enabled')) {
      this.playStep(step);
    }
  },
  
  actions: {
    previous: function() {
      this.set('sound', App.Channel.previous(this.get('sound')));
      this.playSound();
    },
    next: function() {
      this.set('sound', App.Channel.next(this.get('sound')));
      this.playSound();
    },

    delete: function() {
      this.send('deleteChannel', this.get('model'));
    },

    mute: function() {
      this.set('volume', 0);
    },

    unmute: function() {
      this.set('volume', 1);
    },
  }

});



});

require.register("controllers/channels", function(exports, require, module) {
var App = require('app');

App.ChannelsController = Em.ArrayController.extend({
  itemController: 'channel',
  actions: {
     addChannel: function(sound) {
       var channel = App.Channel.create({ sound: sound });
       channel.addSteps(16);
       this.get('model').pushObject(channel);
      },

     deleteChannel: function(channel) {
      this.get('model').removeObject(channel);
     }
  }
});

});

require.register("controllers/playback", function(exports, require, module) {
var App = require('app');

App.PlaybackController = Em.ObjectController.extend({
  tickCount: null,
  isActive: false,
  shareVisible: false,
  actions: {
    start: function() {
      if(!this.get('isActive')) {
        this.set('isActive', true);
        this.tick();
       }
     },
     stop: function() {
       this.set('isActive', false);
       this.set('tickCount', null);
     },
    increaseTempo: function() {
      this.set('tempo', this.get('tempo') + 1);
    },
    decreaseTempo: function() {
      if(this.get('tempo') > 5) {
        this.set('tempo', this.get('tempo') - 1);
      }
    },
    toggleShare: function() {
      this.toggleProperty('shareVisible');
    },
    
  },

  sixteenth: function() {
    return (this.get('tickCount') % 4) + 1;
  }.property('tickCount'),
  beat: function() {
    return Math.floor((this.get('tickCount') / 4) % 4) + 1;
  }.property('sixteenth'),
  bar: function() {
    return Math.floor(this.get('tickCount') / 16) + 1;
  }.property('beat'),
  interval: function() {
    return 1000 / (this.get('tempo') / 60 * 4);
  }.property('tempo'),
  display: function() {
    return this.get('bar') + ':' + this.get('beat') + ':' + this.get('sixteenth');
  }.property('tickCount'),
  
  tick: function() {
    if(this.get('isActive')) {
      this.incrementProperty('tickCount');
      App.pubsub.publish('tick', this.get('tickCount'));

      var self = this;
      setTimeout(function() {
        self.tick();
      }, this.get('interval'));
    }
  },
  encodedPermalink: function() {
    return encodeURIComponent(this.get('permalink'));
  }.property('permalink'),
  emailPermalink: function() {
    return "mailto:?subject=Check Out These Beats&body=" + this.get('encodedPermalink');
  }.property('permalink'),
  googlePermalink: function() {
    return 'https://plus.google.com/share?url=' + this.get('encodedPermalink');
  }.property('permalink'),
  facebookPermalink: function() {
    return 'http://www.facebook.com/sharer.php?u=' + this.get('encodedPermalink');
  }.property('permalink'),
  twitterPermalink: function() {
    return 'http://twitter.com/share?url=' + this.get('encodedPermalink') + '&text=Check%20out%20these%20beats%20';
  }.property('permalink')
});


});

require.register("controllers/song", function(exports, require, module) {
var App = require('app');

App.SongController = Em.ObjectController.extend({
  updateUrl: function() {
    window.history.replaceState({ }, "", this.get('permalink'));
  }.observes('base64Compressed'),
  actions:{
    switchToPreset: function(preset) {
      this.set('model', App.Song.fromPreset(preset));
    }	
  }
  
});

});

require.register("controllers/step", function(exports, require, module) {
var App = require('app');

App.StepController = Em.ObjectController.extend({
  buttonClass: function() {
    var classes = ['step-button ribbon'];

    if(this.get('active')) {
      classes.push('active');
    } else {
      classes.push('inactive');

    }

    var velocity = this.get('velocity');
    if(velocity == 0.5) {
      classes.push('velocity50');
    } else if(velocity == 1) {
      classes.push('velocity100');
    }

     return classes.join(' ');
  }.property('velocity', 'active'),

  click: function() {
    var velocity = this.get('velocity');
    var model = this.get('model');
    if(velocity === 0) {
      this.set('velocity', 0.5);
      this.play();
    } else if(velocity === 0.5) {
      this.set('velocity', 1);
      this.play();
    } else {
      this.set('velocity', 0);
    }
  },

  play: function() {
    this.send('playStep', this.get('model'));
  }
});


});

require.register("controllers/steps", function(exports, require, module) {
var App = require('app');

App.StepsController = Em.ArrayController.extend({
  itemController: 'step',

  addStep: function() {
    this.get('model').pushObject(
      App.Step.create()
    );
  },
  removeStep: function() {
    this.get('model').popObject();
  },
});

});

require.register("initialize", function(exports, require, module) {
window.App = require('app');

require('templates/application');
require('templates/index');
require('templates/channels');
require('templates/partials/_channel');
require('templates/partials/_share');
require('templates/song');
require('templates/playback');
require('templates/steps');

require('models/pubsub');
require('models/song');
require('models/step');
require('models/channel');
require('models/soundPlayer');

require('controllers/channels');
require('controllers/channel');
require('controllers/steps');
require('controllers/step');
require('controllers/song');
require('controllers/playback');

require('router');

App.initialize();

});

require.register("models/channel", function(exports, require, module) {
var App = require('app');

App.Channel = Ember.Object.extend({
  sound: 'kick',
  volume: 1,
  pan: 1,
  steps: null,
  init: function() {
    this._super();
    if(this.get('steps') === null) {
      this.set('steps', Em.A());
    }
  },
  stepCount: function() {
    return this.get('steps').length;
  }.property('steps.length'),
  addStep: function(data) {
    this.get('steps').pushObject(
      App.Step.create(data)
    );
  },
  addSteps: function(n) {
    for(var i=0; i<n; i++) {
      this.addStep();
    }
  },
  lastUpdated: function() {
    return new Date();
  }.property('sound', 'steps.length', 'steps.@each.lastUpdated'),
  serialize: function() {
    return {
      sound: this.get('sound'),
      volume: this.get('volume'),
      steps: this.get('steps').invoke('serialize')
    };
  }
}).reopenClass({
  sounds: [
    'cowbell',
    'conga_hi',
    'cymbal',
    'conga_mid',
    'conga_low',
    'hihat_open',
    'tom_hi',
    'maracas',
    'tom_mid',
    'hihat_closed',
    'tom_low',
    'clave',
    'clap',
    'snare',
    'rim',
    'kick'
  ],
  previous: function(sound) {
    var index = this.sounds.indexOf(sound);
    if(index === 0) {
      index = this.sounds.length;
    }
    return this.sounds[index - 1];
  },
  next: function(sound) {
    var index = this.sounds.indexOf(sound);
    if(index == this.sounds.length - 1) {
      index = -1;
    }
    return this.sounds[index + 1];
  },
  deserialiseArray: function(data) {
    return Em.A(
      data.map(function(item) {
        return App.Channel.create({
          sound: item.sound,
          volume: item.volume,
          steps: App.Step.deserialiseArray(item.steps)
        });
      })
    );
  }
});

});

require.register("models/pubsub", function(exports, require, module) {
var App = require('app');

App.pubsub = Ember.Object.createWithMixins(Ember.Evented, {
  publish: function() {
    return this.trigger.apply(this, arguments);
  },

  subscribe: function() {
    return this.on.apply(this, arguments);
  },

  unsubscribe: function() {
    return this.off.apply(this, arguments);
  }
});

});

require.register("models/song", function(exports, require, module) {
var App = require('app');

App.Song = Ember.Object.extend({
  name: '',
  tempo: 100,
  channels: Em.A(),

  json: function() {
    return JSON.stringify(this.serialize());
  }.property('lastUpdated', 'channels.@each.lastUpdated'),
  base64Compressed: function() {
    var base64 = LZString.compressToBase64(this.get('json'));
    return encodeURIComponent(base64);
  }.property('json'),
  permalink: function() {
    return location.protocol + "//" + location.host + "/#/song/" + this.get('base64Compressed');
  }.property('base64Compressed'),
  lastUpdated: function() {
    return new Date();
  }.property('name', 'tempo'),
  serialize: function() {
    return {
      name: this.get('name'),
      tempo: this.get('tempo'),
      channels: this.get('channels').invoke('serialize')
    };
  }
}).reopenClass({
  deserialise: function(data) {
    return App.Song.create({
      name: data.name,
      tempo: data.tempo,
      channels: App.Channel.deserialiseArray(data.channels)
    });
  },
  fromBase64Compressed: function(base64) {
    base64 = decodeURIComponent(base64);
    var json = LZString.decompressFromBase64(base64);
    return App.Song.deserialise(JSON.parse(json));
  },
  fromPreset: function(preset) {
    return App.Song.fromBase64Compressed(
      App.Song.presets[preset]
    );
  },
  default: function() {
    return App.Song.fromPreset('default');
  },
  presets: {
    'default': 'N4IgdghgtgpiBcIQBoQBcZQA4HsEEYAGQ1AYwAsIwwYAbAZwQG1R6cBXMAEwRAGsAlqT4oQANxy12sAqnoYsjeC3F0cpAWgCeBAL7JQYtRu0JC%2Bw8c0745g6trrrZiw6enbro45M27ln2dPe293Py8rD3wIwI9%2FN189EMjw5NjUgLCXNKzgzMTPAF1XNk4eRHpIACc4VAkpGXh8OQUlFVCC%2BI6grpTs%2FJ6Y3OiczqGx0cHJuPGpgZnpjISgkfml7oW1l2L7Uu5ecgFKNAB9Ukd6GB46yWk4JpaYRWYt2wA6AFZZzeWo7%2FW%2Bu8vot%2Br8bKswaCNn5Pv8oYCIdD4ekzLCQXlIU04UVdMUgAA%3D%3D',
    '15step': 'N4IgdghgtgpiBcICMBWABAZQC4wA5oAoAlCAEwEsB7ACxjIEoQAaEHKXShAThRYGNqEMGBgAbAM4IA2qHGUArmFIIQAa3J9VzEADdKo%2BbARIW4nLknwZusZT7ksAT2MBfJqB237ThAAY3Hl4OzvD%2B7jaidsF%2BARFRPqGxnpHeIWGBKdGhAHQoSUEJvrn5mYUl8WkuALqxcorKiOKQAE5wLHoGRvAmIGZ4ltbJFTHhQ6kjGcOJowUhSOXj05OL8zOllWtT6XErC1n%2BNeF1SirU5IJYAPp8keIwyu36hnDdpuYDy%2Ft7ZZuLRXm%2FL6AwrFYEbT4JVYQ8E7fag6ExQ6yBQnRA3CC4bQdZ7GN79aQIpawn6E%2F7fGFjOEA0nkvzw4kU2Z06kMiasomUkns7actL03lsgUcpk5FlCnkiiXrRHVFxAAA',
    'sundaybloodysunday': 'N4IgdghgtgpiBcIDKBXMATCBPABAIQBsB7I9XVDbHACgFUAmAShxABoQAXGKAByIQCMABiHsAxgAsIYMDAIBnBAG1Q8omnQIQ8yACc47AG5ECKWIPbyuPRfBUhDcomICWHLAiEA6AKwBfVlBHYld3QQCgp1CPeCEIhyi3GLjAhJCk8NTg5wzY%2BOzoz3zEsLyskuTi9NKUyOrK8vqixpyaqtaGuo7PX3bC%2BAE%2B3Nq07rKu%2FpGC4aG2lsnZ5N753MGVuYmZ9c7Rhe3mzY3d4eXDmLWznv99gcWD46Pp0ouHnae3ivv3r8%2Fx15%2Bmn9vkDflNQad%2FrcbmDATCxnC9pcQbC7rEIcCXsCEVskdjHqDUXiltdcX4ALrxNQaLQAaxcYhpbAcJjMcAGlmstnsWPRBOhhMJvJR%2FJFuKF8IFosh3hJ0slpIpqSpGC0EhcUg4AH0xMR5DBNEYWeZ2dpOcokZjwbKedarajLbDxZMnSdbYCHfCXTUvcT7YK3Z6A87%2FBSKUAA%3D',
    'sexualhealing': 'N4IgdghgtgpiBcIDKMAeBXCAbABACRmwEswBzHACgFkIAnANxJwHEIBPGAShABoQAXGFAAOAewQBOAKx8AxgAsIYMDCwBnBAG1Qa0ejAATBCADWRWSd4h6orOlgIAjHzWDhG%2BNuurRsovzYnAF8eUHofPwCEAAYQsIj%2FQPhY0O8sX0SYuLSMqOTs8PTIpJT4osz81MLcpMcChLzogDopevLGtprgqoaSzuLusq7KoYGRnLG6nvba%2ForSifm5junhheqx9d6s1cnlvt2lw5XRo9OTxYuNs8vZgF1s3X0jRDVIWjg%2BGzsHeGcQVwwdxac4HUE7cHja5XbZQ2FbGYQ25I6Fg5FwxHJFr7QbohFrHEYgnHNGolHwwn4zaUynYkkxOmQqkVKZMwmsvG01r0onUh6pJ6GYzyIiKfgAfVk6TUMCMX1s9jgfxcbg8XjJWO5bJ5zS1nJ1jP1TMNGuZjRNFINetNXJpVtt9p1Du1xutltddo9jq9LrxFsxZpK%2FrW2P5Oj0QsQIrF4tEwhgYCs30VThVQLVvptTuzmfdfrdAc9RuLWdzhZzJbzpfzRerdfhwepFfr5Z9lYDjZuNrDAIjLxAUogwiTCt%2B%2F0BwM8ZeJ06bkI5LZn7aXi7ny7Xq67FJ7gv7g%2FCI5%2BSvHqpBNebVYbBZXl9b59nW7vm5hT9vN47143b82nZf75Dn6Pv%2BX4frW37zL%2BpLbo8fbGPwohQOKIqHimyoAqeU7rkBP6AX%2BIHAdhhF4URUGvmRBHER0O6wYg8GIVARBytYo7Hmmk7quBlGkRR3H4XxJHkuR%2FFcYJPGicJvECbyUmBuJUkLpxkkidJymySpfTUc8cEIeK6QAO4oWObEZlhqlgUJMnmWJ6lyWZF4WXZD6OaZSmubZbk2Z5akKQ5sxOg8DxAAAA%3D',
    'juicy': 'N4IgdghgtgpiBcIQBoQBcZQA4HsEE4AOVAYwAsIwwYAbAZwQG1Q6cBXMAEwRAGsBLErxQgAbjhptYCAIyo6GLA3jMxtHCX5oAnrIC%2ByUKPWadCAAwGjJrbviXDamhtsWrTl2fgz3x56bsHa39Xb18bLyCPAIsAOgBWcJDIpM9A1Jj7DNCovzS3RzzM3Ij0gF13Vg5uRDpIACc4VHFJaW95RWVVIpzslMLSguD8sIHk9LGR8wS%2BieHi2aHo3smF1ZX5nJn1%2Fs3d5ZSKxyquHjJ%2BCjQAfRJnOhhuZokpOHaQBRglJj27Hx25g4Anr7YFAwZZf5LUFuI4sdinRC3CBYEQtF6yDqfLo%2FKHgkrjXEEiE44mAwlTRak6FUvGU%2FEUyE0on0tYklkbMlMhlsum8xnskG0%2Fl8nn87aiiWcywVCpAAAA%3D%3D'
  }
});

});

require.register("models/soundPlayer", function(exports, require, module) {
var App = require('app');

App.SoundPlayer = Ember.Object.create({
    init: function() {
        var self = this;
        App.pubsub.subscribe('sound', function(sound) {
          self.howl.play(sound.sound, function(soundID) {
            self.howl.volume(sound.velocity, soundID);
            self.howl.pos3d({x: sound.pan }, soundID);
          });
        });
    },
    howl: new Howl({
        urls: ['sprite.mp3'],
        sprite: {
            cowbell: [0, 300],
            conga_hi: [400, 300],
            cymbal: [807, 3640],
            conga_mid: [4455, 202],
            conga_low: [4863, 343],
            hihat_open: [5268, 706],
            tom_hi: [6277, 206],
            maracas: [6684, 53],
            tom_mid: [7092, 263],
            hihat_closed: [7496, 90],
            tom_low: [7903, 370],
            clave: [8307, 44],
            clap: [8712, 208],
            snare: [9116, 137],
            rim: [9521, 36],
            kick: [9929, 390]
        }
    })
});

});

require.register("models/step", function(exports, require, module) {
var App = require('app');

App.Step = Ember.Object.extend({
  active: false,
  velocity: 0,
  enabled: function() {
    return this.get('velocity') !== 0;
  }.property('velocity'),
  lastUpdated: function() {
    return new Date();
  }.property('velocity'),
  serialize: function() {
    return {
      velocity: this.get('velocity')
    };
  }

}).reopenClass({
  deserialiseArray: function(data) {
    return Em.A(
      data.map(function(item) {
        return App.Step.create(item);
      })
    );
  }
});

});

require.register("router", function(exports, require, module) {
var App = require('app');

App.IndexRoute = Em.Route.extend({
  model: function() {
    return App.Song.default();
  }
});

App.SongRoute = Em.Route.extend({
  model: function(params) {
    return App.Song.fromBase64Compressed(params.base64);
  }
});

App.Router.map(function(){
    this.route('index', { path:'/' });
    this.route('song', { path: '/song/:base64' });
});

});

require.register("templates/application", function(exports, require, module) {
module.exports = Ember.TEMPLATES['application'] = Ember.Handlebars.template(function anonymous(Handlebars,depth0,helpers,partials,data) {
this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Ember.Handlebars.helpers); data = data || {};
  var buffer = '', hashTypes, hashContexts, escapeExpression=this.escapeExpression;


  data.buffer.push("<div class=\"container\">\n  <div class=\"header\">\n    <h2><a href=\"/\">Ember.js Beats</a></h2>\n\n    <span>\n      <a href=\"https://twitter.com/gavinjoyce\">@gavinjoyce</a> |\n      <a href=\"https://github.com/GavinJoyce/ember-beats\">Source</a>\n    </span>\n  </div>\n\n  <br style=\"clear: both\" />\n\n  ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers._triageMustache.call(depth0, "outlet", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push("\n</div>\n");
  return buffer;
  
});
});

require.register("templates/channels", function(exports, require, module) {
module.exports = Ember.TEMPLATES['channels'] = Ember.Handlebars.template(function anonymous(Handlebars,depth0,helpers,partials,data) {
this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Ember.Handlebars.helpers); data = data || {};
  var buffer = '', stack1, hashTypes, hashContexts, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = '', stack1, hashTypes, hashContexts, options;
  data.buffer.push("\n    ");
  hashTypes = {};
  hashContexts = {};
  options = {hash:{},contexts:[depth0],types:["STRING"],hashContexts:hashContexts,hashTypes:hashTypes,data:data};
  data.buffer.push(escapeExpression(((stack1 = helpers.partial || depth0.partial),stack1 ? stack1.call(depth0, "partials/channel", options) : helperMissing.call(depth0, "partial", "partials/channel", options))));
  data.buffer.push("\n  ");
  return buffer;
  }

function program3(depth0,data) {
  
  var buffer = '', hashTypes, hashContexts;
  data.buffer.push("\n        <li>\n          <a ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "addChannel", "sound", {hash:{},contexts:[depth0,depth0],types:["ID","ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n            ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers._triageMustache.call(depth0, "sound", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push("\n          </a>\n        </li>\n      ");
  return buffer;
  }

  data.buffer.push("<div class=\"main\">\n\n  ");
  hashTypes = {};
  hashContexts = {};
  stack1 = helpers.each.call(depth0, {hash:{},inverse:self.noop,fn:self.program(1, program1, data),contexts:[],types:[],hashContexts:hashContexts,hashTypes:hashTypes,data:data});
  if(stack1 || stack1 === 0) { data.buffer.push(stack1); }
  data.buffer.push("\n\n\n  <div class=\"btn-group\" style=\"margin-top: 14px; margin-left: 18px\">\n    <a class=\"btn dropdown-toggle\" data-toggle=\"dropdown\" href=\"#\">\n      Add Channel\n      <span class=\"caret\"></span>\n    </a>\n    <ul class=\"dropdown-menu\">\n      ");
  hashTypes = {};
  hashContexts = {};
  stack1 = helpers.each.call(depth0, "sound", "in", "App.Channel.sounds", {hash:{},inverse:self.noop,fn:self.program(3, program3, data),contexts:[depth0,depth0,depth0],types:["ID","ID","ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data});
  if(stack1 || stack1 === 0) { data.buffer.push(stack1); }
  data.buffer.push("\n    </ul>\n  </div>\n</div>\n");
  return buffer;
  
});
});

require.register("templates/index", function(exports, require, module) {
module.exports = Ember.TEMPLATES['index'] = Ember.Handlebars.template(function anonymous(Handlebars,depth0,helpers,partials,data) {
this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Ember.Handlebars.helpers); data = data || {};
  var buffer = '', stack1, hashTypes, hashContexts, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  hashTypes = {};
  hashContexts = {};
  options = {hash:{},contexts:[depth0,depth0],types:["STRING","ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data};
  data.buffer.push(escapeExpression(((stack1 = helpers.render || depth0.render),stack1 ? stack1.call(depth0, "song", "model", options) : helperMissing.call(depth0, "render", "song", "model", options))));
  data.buffer.push("\n");
  return buffer;
  
});
});

require.register("templates/partials/_channel", function(exports, require, module) {
module.exports = Ember.TEMPLATES['partials/_channel'] = Ember.Handlebars.template(function anonymous(Handlebars,depth0,helpers,partials,data) {
this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Ember.Handlebars.helpers); data = data || {};
  var buffer = '', stack1, hashContexts, hashTypes, options, escapeExpression=this.escapeExpression, self=this, helperMissing=helpers.helperMissing;

function program1(depth0,data) {
  
  var buffer = '', hashTypes, hashContexts;
  data.buffer.push("\n       <button type=\"button\" class=\"tiny transparent\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "mute", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n        <i class=\"icon-volume-off icon-white\"></i>\n      </button>\n      ");
  return buffer;
  }

function program3(depth0,data) {
  
  var buffer = '', hashTypes, hashContexts;
  data.buffer.push("\n          <button type=\"button\" class=\"tiny transparent\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "unmute", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n          <i class=\"icon-volume-up icon-white\"></i>\n      </button>\n      ");
  return buffer;
  }

  data.buffer.push("<div ");
  hashContexts = {'class': depth0};
  hashTypes = {'class': "STRING"};
  data.buffer.push(escapeExpression(helpers.bindAttr.call(depth0, {hash:{
    'class': ("class")
  },contexts:[],types:[],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n  <span class=\"channel-cycle\">\n    <div>\n      <button type=\"button\" class=\"tiny transparent\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "previous", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n        <i class=\"icon-circle-arrow-up icon-white\"></i>\n      </button>\n    </div>\n    <div>\n      <button type=\"button\" class=\"tiny transparent\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "next", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n        <i class=\"icon-circle-arrow-down icon-white\"></i>\n      </button>\n    </div>\n  </span>\n  <span class=\"controls\">\n    <h3>");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers._triageMustache.call(depth0, "sound", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push("</h3>\n    <span class=\"channel-closer\">\n      ");
  hashTypes = {};
  hashContexts = {};
  stack1 = helpers['if'].call(depth0, "volume", {hash:{},inverse:self.program(3, program3, data),fn:self.program(1, program1, data),contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data});
  if(stack1 || stack1 === 0) { data.buffer.push(stack1); }
  data.buffer.push("\n      <button type=\"button\" class=\"tiny transparent\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "delete", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n        <i class=\"icon-remove-circle icon-white\"></i>\n      </button>\n    </span>\n  </span>\n\n  ");
  hashTypes = {};
  hashContexts = {};
  options = {hash:{},contexts:[depth0,depth0],types:["STRING","ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data};
  data.buffer.push(escapeExpression(((stack1 = helpers.render || depth0.render),stack1 ? stack1.call(depth0, "steps", "steps", options) : helperMissing.call(depth0, "render", "steps", "steps", options))));
  data.buffer.push("\n</div>\n");
  return buffer;
  
});
});

require.register("templates/partials/_share", function(exports, require, module) {
module.exports = Ember.TEMPLATES['partials/_share'] = Ember.Handlebars.template(function anonymous(Handlebars,depth0,helpers,partials,data) {
this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Ember.Handlebars.helpers); data = data || {};
  var buffer = '', hashContexts, hashTypes, escapeExpression=this.escapeExpression;


  data.buffer.push("<div class=\"share\">\n\n  Song Name: ");
  hashContexts = {'valueBinding': depth0};
  hashTypes = {'valueBinding': "STRING"};
  data.buffer.push(escapeExpression(helpers.view.call(depth0, "Em.TextField", {hash:{
    'valueBinding': ("name")
  },contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push("\n\n  <hr />\n\n  Share a <a ");
  hashContexts = {'href': depth0};
  hashTypes = {'href': "STRING"};
  data.buffer.push(escapeExpression(helpers.bindAttr.call(depth0, {hash:{
    'href': ("permalink")
  },contexts:[],types:[],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">link</a> to this song via <a ");
  hashContexts = {'href': depth0};
  hashTypes = {'href': "STRING"};
  data.buffer.push(escapeExpression(helpers.bindAttr.call(depth0, {hash:{
    'href': ("emailPermalink")
  },contexts:[],types:[],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">Email</a>, <a ");
  hashContexts = {'href': depth0};
  hashTypes = {'href': "STRING"};
  data.buffer.push(escapeExpression(helpers.bindAttr.call(depth0, {hash:{
    'href': ("googlePermalink")
  },contexts:[],types:[],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">Google+</a>, <a ");
  hashContexts = {'href': depth0};
  hashTypes = {'href': "STRING"};
  data.buffer.push(escapeExpression(helpers.bindAttr.call(depth0, {hash:{
    'href': ("facebookPermalink")
  },contexts:[],types:[],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">Facebook</a> and <a ");
  hashContexts = {'href': depth0};
  hashTypes = {'href': "STRING"};
  data.buffer.push(escapeExpression(helpers.bindAttr.call(depth0, {hash:{
    'href': ("twitterPermalink")
  },contexts:[],types:[],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">Twitter</a>\n</div>\n");
  return buffer;
  
});
});

require.register("templates/playback", function(exports, require, module) {
module.exports = Ember.TEMPLATES['playback'] = Ember.Handlebars.template(function anonymous(Handlebars,depth0,helpers,partials,data) {
this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Ember.Handlebars.helpers); data = data || {};
  var buffer = '', stack1, hashTypes, hashContexts, escapeExpression=this.escapeExpression, helperMissing=helpers.helperMissing, self=this;

function program1(depth0,data) {
  
  var buffer = '', hashTypes, hashContexts;
  data.buffer.push("\n      <button type=\"button\" class=\"btn btn-large\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "start", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n        <i class=\"icon-play\"></i>\n      </button>\n      ");
  return buffer;
  }

function program3(depth0,data) {
  
  var buffer = '', hashTypes, hashContexts;
  data.buffer.push("\n      <button type=\"button\" class=\"btn btn-large btn-danger\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "stop", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n        <i class=\"icon-stop\"></i>\n      </button>\n      ");
  return buffer;
  }

function program5(depth0,data) {
  
  var buffer = '', stack1, hashTypes, hashContexts, options;
  data.buffer.push("\n  ");
  hashTypes = {};
  hashContexts = {};
  options = {hash:{},contexts:[depth0],types:["STRING"],hashContexts:hashContexts,hashTypes:hashTypes,data:data};
  data.buffer.push(escapeExpression(((stack1 = helpers.partial || depth0.partial),stack1 ? stack1.call(depth0, "partials/share", options) : helperMissing.call(depth0, "partial", "partials/share", options))));
  data.buffer.push("\n");
  return buffer;
  }

  data.buffer.push("<div class=\"playback\">\n  <div class=\"btn-toolbar\">\n\n      ");
  hashTypes = {};
  hashContexts = {};
  stack1 = helpers.unless.call(depth0, "isActive", {hash:{},inverse:self.program(3, program3, data),fn:self.program(1, program1, data),contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data});
  if(stack1 || stack1 === 0) { data.buffer.push(stack1); }
  data.buffer.push("\n\n    <div class=\"btn-group\"></div>\n\n    <div class=\"btn-group\">\n      <button type=\"button\" class=\"btn btn-large\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "decreaseTempo", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n        <i class=\"icon-minus-sign\"></i>\n      </button>\n      <button type=\"button\" class=\"btn btn-large\"><strong>");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers._triageMustache.call(depth0, "tempo", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(" bpm</strong></button>\n      <button type=\"button\" class=\"btn btn-large\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "increaseTempo", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n        <i class=\"icon-plus-sign\"></i>\n      </button>\n    </div>\n\n    <div class=\"btn-group\">\n      <button type=\"button\" class=\"btn btn-large\"><strong>");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers._triageMustache.call(depth0, "display", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push("</strong></button>\n    </div>\n\n    <div class=\"btn-group\">\n      <a class=\"btn btn-large dropdown-toggle \" data-toggle=\"dropdown\" href=\"#\">\n        Presets\n        <span class=\"caret\"></span>\n      </a>\n      <ul class=\"dropdown-menu\">\n          <li>\n            <a ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "switchToPreset", "default", {hash:{},contexts:[depth0,depth0],types:["ID","STRING"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">Default</a>\n            <a ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "switchToPreset", "sundaybloodysunday", {hash:{},contexts:[depth0,depth0],types:["ID","STRING"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">Sunday Bloody Sunday - U2</a>\n            <a ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "switchToPreset", "sexualhealing", {hash:{},contexts:[depth0,depth0],types:["ID","STRING"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">Sexual Healing - Marvin Gaye</a>\n            <a ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "switchToPreset", "15step", {hash:{},contexts:[depth0,depth0],types:["ID","STRING"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">15 Step - Radiohead</a>\n            <a ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "switchToPreset", "juicy", {hash:{},contexts:[depth0,depth0],types:["ID","STRING"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">Juicy - B.I.G.</a>\n          </li>\n      </ul>\n    </div>\n\n    <div class=\"btn-group\" style=\"float: right;\">\n      <button type=\"button\" class=\"btn\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "toggleShare", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n        <strong>Share Song</strong>\n        <i class=\"icon-share\"></i>\n      </button>\n    </div>\n  </div>\n</div>\n\n");
  hashTypes = {};
  hashContexts = {};
  stack1 = helpers['if'].call(depth0, "shareVisible", {hash:{},inverse:self.noop,fn:self.program(5, program5, data),contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data});
  if(stack1 || stack1 === 0) { data.buffer.push(stack1); }
  data.buffer.push("\n");
  return buffer;
  
});
});

require.register("templates/song", function(exports, require, module) {
module.exports = Ember.TEMPLATES['song'] = Ember.Handlebars.template(function anonymous(Handlebars,depth0,helpers,partials,data) {
this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Ember.Handlebars.helpers); data = data || {};
  var buffer = '', stack1, stack2, hashTypes, hashContexts, options, escapeExpression=this.escapeExpression, helperMissing=helpers.helperMissing, self=this;

function program1(depth0,data) {
  
  var buffer = '', hashTypes, hashContexts;
  data.buffer.push("\n  <div>\n    <style>\n      textarea { width: 100%; height: 200px; }\n    </style>\n\n\n    <hr />\n    <h1>Debug Info</h1>\n\n    <h2>Json: (");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers._triageMustache.call(depth0, "json.length", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(")<h2>\n    ");
  hashContexts = {'valueBinding': depth0};
  hashTypes = {'valueBinding': "STRING"};
  data.buffer.push(escapeExpression(helpers.view.call(depth0, "Ember.TextArea", {hash:{
    'valueBinding': ("json")
  },contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push("\n\n    <h2>Permalink: (");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers._triageMustache.call(depth0, "permalink.length", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(")<h2>\n    ");
  hashContexts = {'valueBinding': depth0};
  hashTypes = {'valueBinding': "STRING"};
  data.buffer.push(escapeExpression(helpers.view.call(depth0, "Ember.TextArea", {hash:{
    'valueBinding': ("permalink")
  },contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push("\n  </div>\n");
  return buffer;
  }

  hashTypes = {};
  hashContexts = {};
  options = {hash:{},contexts:[depth0,depth0],types:["STRING","ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data};
  data.buffer.push(escapeExpression(((stack1 = helpers.render || depth0.render),stack1 ? stack1.call(depth0, "playback", "model", options) : helperMissing.call(depth0, "render", "playback", "model", options))));
  data.buffer.push("\n");
  hashTypes = {};
  hashContexts = {};
  options = {hash:{},contexts:[depth0,depth0],types:["STRING","ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data};
  data.buffer.push(escapeExpression(((stack1 = helpers.render || depth0.render),stack1 ? stack1.call(depth0, "channels", "model.channels", options) : helperMissing.call(depth0, "render", "channels", "model.channels", options))));
  data.buffer.push("\n\n");
  hashTypes = {};
  hashContexts = {};
  stack2 = helpers['if'].call(depth0, "debug", {hash:{},inverse:self.noop,fn:self.program(1, program1, data),contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data});
  if(stack2 || stack2 === 0) { data.buffer.push(stack2); }
  data.buffer.push("\n");
  return buffer;
  
});
});

require.register("templates/steps", function(exports, require, module) {
module.exports = Ember.TEMPLATES['steps'] = Ember.Handlebars.template(function anonymous(Handlebars,depth0,helpers,partials,data) {
this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Ember.Handlebars.helpers); data = data || {};
  var buffer = '', stack1, hashContexts, hashTypes, escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = '', hashContexts, hashTypes;
  data.buffer.push("\n       <li class=\"step\">\n        <a href=\"#\" ");
  hashContexts = {'class': depth0};
  hashTypes = {'class': "STRING"};
  data.buffer.push(escapeExpression(helpers.bindAttr.call(depth0, {hash:{
    'class': ("buttonClass")
  },contexts:[],types:[],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "click", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push("></a>\n      </li>\n    ");
  return buffer;
  }

  data.buffer.push("<span class=\"steps\">\n  <ul>\n    ");
  hashContexts = {'itemController': depth0};
  hashTypes = {'itemController': "STRING"};
  stack1 = helpers.each.call(depth0, "step", "in", "model", {hash:{
    'itemController': ("step")
  },inverse:self.noop,fn:self.program(1, program1, data),contexts:[depth0,depth0,depth0],types:["ID","ID","ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data});
  if(stack1 || stack1 === 0) { data.buffer.push(stack1); }
  data.buffer.push("\n  </ul>\n</span>\n\n<span class=\"steps-controls\">\n  <div>\n    <button type=\"button\" class=\"tiny transparent\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "addStep", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n      <i class=\"icon-plus-sign icon-white\"></i>\n    </button>\n  </div>\n  <div>\n    <button type=\"button\" class=\"tiny transparent\" ");
  hashTypes = {};
  hashContexts = {};
  data.buffer.push(escapeExpression(helpers.action.call(depth0, "removeStep", {hash:{},contexts:[depth0],types:["ID"],hashContexts:hashContexts,hashTypes:hashTypes,data:data})));
  data.buffer.push(">\n      <i class=\"icon-minus-sign icon-white\"></i>\n    </button>\n  </div>\n</span>\n");
  return buffer;
  
});
});


//@ sourceMappingURL=app.js.map