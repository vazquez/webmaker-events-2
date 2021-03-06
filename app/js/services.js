// Services -------------------------------------------------------------------

angular.module('myApp.services', ['ngResource'])
  .constant('config', window.eventsConfig)
  .constant('analytics', window.analytics)
  .constant('langmap', window.languageMappingList)
  .factory('loadGoogleMaps', ['$window',
    function ($window) {

      function initialize(callback) {
        $window.onInit = callback;
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://maps.googleapis.com/maps/api/js?libraries=places&sensor=false&' +
          'callback=onInit';
        document.body.appendChild(script);
      }

      return {
        ready: function (callback) {
          if ($window.google) {
            callback();
          } else {
            initialize(callback);
          }
        }
      };
    }
  ])
  .factory('eventService', ['$rootScope', '$resource', 'config',
    function ($rootScope, $resource, config) {
      return function (customHeaders) {
        return $resource(config.eventsLocation + '/events/:id', {
          username: '@username',
          after: '@after',
          dedupe: '@dedupe',
          tag: '@tag'
        }, {
          get: {
            method: 'GET',
            withCredentials: true
          },
          query: {
            method: 'GET',
            isArray: true,
            withCredentials: true,
            headers: customHeaders || null
          },
          save: {
            method: 'POST',
            withCredentials: true
          },
          'delete': {
            method: 'DELETE',
            withCredentials: true
          },
          update: {
            method: 'PUT',
            withCredentials: true
          }
        });
      };
    }
  ])
  .factory('relatedEventService', ['$rootScope', '$resource', 'config',
    function ($rootScope, $resource, config) {
      return $resource(config.eventsLocation + '/events/:id/related', {}, {
        query: {
          method: 'GET',
          isArray: true,
          withCredentials: false
        }
      });
    }
  ])
  .factory('tokenService', ['$rootScope', '$resource', 'config',
    function ($rootScope, $resource, config) {
      return $resource(config.eventsLocation + '/verify/token/:token', {
        eventId: '@eventId'
      }, {
        verifyToken: {
          method: 'GET',
          withCredentials: true
        }
      });
    }
  ])
  .factory('attendeeService', ['$resource', 'config',
    function ($resource, config) {
      return $resource(config.eventsLocation + '/attendee', {
        userid: '@userid',
        email: '@email',
        eventid: '@eventid',
        checkin: '@checkin',
        rsvp: '@rsvp',
        isPrivate: '@isPrivate'
      }, {
        save: {
          method: 'POST',
          withCredentials: true
        }
      });
    }
  ])
  .factory('attendeeInfoService', ['$resource', 'config',
    function ($resource, config) {
      return $resource(config.eventsLocation + '/attendee/user/:userid', {}, {
        get: {
          isArray: true,
          method: 'GET',
          withCredentials: true
        }
      });
    }
  ])
  .factory('attendeeListService', ['$resource', 'config',
    function ($resource, config) {
      return $resource(config.eventsLocation + '/attendee/event/:eventid', {}, {
        get: {
          isArray: true,
          method: 'GET',
          withCredentials: true
        }
      });
    }
  ])
  .factory('usernameService', ['$resource', 'config',
    function ($resource, config) {
      return $resource('/check-username', {
        username: '@username'
      }, {
        post: {
          method: 'POST'
        }
      });
    }
  ])
  .factory('eventFormatter', ['$rootScope', 'moment', 'localize',
    function ($rootScope, moment, localize) {

      return function (form, eventData) {
        if (!form || !eventData) {
          console.warn('You must provide a form instance and event data on a $scope');
          return;
        }

        if (form.$invalid) {
          // prevent form from being sent if there are invalid fields
          console.warn('Form is invalid.');
          window.scrollTo(0, 0);
          return;
        }

        // Create a serialized event object to avoid modifying $scope
        var serializedEvent = angular.copy(eventData);

        if (eventData.duration !== 'unknown') {
          serializedEvent.endDate = moment(eventData.beginDate).add('hours', parseFloat(eventData.duration, 10)).toISOString();
          // Don't send an end date if duration is not specific
        } else {
          delete serializedEvent.endDate;
        }

        // Empty strings or whitespace shouldn't be considered URLs
        if (typeof serializedEvent.registerLink === 'string' && serializedEvent.registerLink.trim() === '') {
          serializedEvent.registerLink = null;
        }

        // Remove nonexistant DB values from client event object
        delete serializedEvent.duration;

        // Convert CSV tags to array of Strings
        if (!serializedEvent.tags) {
          serializedEvent.tags = [];
        } else if (typeof serializedEvent.tags === 'string') {
          var tagArray = serializedEvent.tags.split(',');

          tagArray.forEach(function (tag, index) {
            tagArray[index] = tag.trim();
          });

          serializedEvent.tags = tagArray;
        }

        // Create unified description from 3 fields
        if (serializedEvent.description1 && serializedEvent.description2 && serializedEvent.description3) {
          serializedEvent.description =
            '<h3>' + localize.getLocalizedString('_desc_header_1_') + '</h3>\n' +
            '<p>' + serializedEvent.description1 + '</p>\n\n' +
            '<h3>' + localize.getLocalizedString('_desc_header_2_') + '</h3>\n' +
            '<p>' + serializedEvent.description2 + '</p>\n\n' +
            '<h3>' + localize.getLocalizedString('_desc_header_3_') + '</h3>\n' +
            '<p>' + serializedEvent.description3 + '</p>';

          delete serializedEvent.description1;
          delete serializedEvent.description2;
          delete serializedEvent.description3;
        }

        return serializedEvent;
      };
    }
  ])
  .factory('moment', ['$window', 'config',
    function ($window, config) {
      var moment = $window.moment;
      moment.lang(config.lang);
      return moment;
    }
  ])
  .factory('dateIsToday', ['moment',
    function (moment) {
      return function (date) {
        var todayMoment = moment();
        var eventMoment = moment(date);

        if (todayMoment.year() === eventMoment.year() &&
          todayMoment.dayOfYear() === eventMoment.dayOfYear()) {
          return true;
        } else {
          return false;
        }
      };
    }
  ])
  .factory('eventEditableService', ['$rootScope',
    function ($rootScope) {
      function isCoorganizer(event) {
        if (!event.coorganizers) {
          return false;
        }
        return event.coorganizers.some(function (c) {
          return c.userId === $rootScope._user.id;
        });
      }

      function isOrganizer(event) {
        return event.organizerId === $rootScope._user.username;
      }

      function isAdmin() {
        return $rootScope._user.isAdmin;
      }

      return {
        isMentor: function (event) {
          if (!event.mentors) {
            return false;
          }
          return event.mentors.some(function (m) {
            return m.userId === $rootScope._user.id;
          });
        },
        isCoorganizer: isCoorganizer,
        isOrganizer: isOrganizer,
        isAdmin: isAdmin,
        canEdit: function (event) {
          return isCoorganizer(event) || isOrganizer(event) || isAdmin();
        }
      };
    }
  ])
  .factory('processLangMap', function () {
    function baseLangPresent(locale, delim, langMap) {
      var parts = locale.split(delim);

      if (parts.length > 1) {
        var base = parts[0];
        if (langMap[base]) {
          return true;
        }
      }

      return false;
    }

    return function (langMap, wantArray) {
      var processed = wantArray ? [] : {};

      Object.keys(langMap).forEach(function (locale, idx, keys) {
        //Let's only show each language once,
        //for example en-US, en-GB and 'en'
        //should only keep 'en'.

        //For each 'locale-country' string, ignore it if
        //just 'locale' is also on the list.

        if (baseLangPresent(locale, '-', langMap) || baseLangPresent(locale, '@', langMap)) {
          return;
        }

        var lang = langMap[locale];

        if (wantArray) {
          processed.push([locale, lang.englishName + ' (' + lang.nativeName + ')']);
        } else {
          processed[locale] = lang.englishName + ' (' + lang.nativeName + ')';
        }
      });

      if (wantArray) {
        processed.sort(function (first, second) {
          return first[1].localeCompare(second[1]);
        });
      }

      return processed;
    };
  });
