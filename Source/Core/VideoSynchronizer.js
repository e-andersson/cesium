/*global define*/
define([
        './defaultValue',
        './defined',
        './defineProperties',
        './destroyObject',
        './DeveloperError',
        './Event',
        './Iso8601',
        './JulianDate'
    ], function(
        defaultValue,
        defined,
        defineProperties,
        destroyObject,
        DeveloperError,
        Event,
        Iso8601,
        JulianDate) {
    "use strict";

    /**
     * A {@link MaterialProperty} that maps to image {@link Material} uniforms.
     * @alias VideoSynchronizer
     * @constructor
     */
    var VideoSynchronizer = function(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        this._clock = undefined;
        this._element = undefined;
        this._clockSubscription = undefined;
        this._seekFunction = undefined;

        this.clock = options.clock;
        this.element = options.element;
        this.epoch = options.epoch;

        this._seeking = false;
        this._seekFunction = undefined;
        this._lastSeek = 0;
    };

    defineProperties(VideoSynchronizer.prototype, {
        /**
         * A string {@link Property} which is the url of the desired video.
         * @type {Property}
         */
        clock : {
            get : function() {
                return this._clock;
            },
            set : function(value) {
                var oldValue = this._clock;

                if (oldValue === value) {
                    return;
                }

                if (defined(oldValue)) {
                    this._clockSubscription();
                    this._clockSubscription = undefined;
                }

                if (defined(value)) {
                    this._clockSubscription = value.onTick.addEventListener(this._onTick, this);
                }

                this._clock = value;
            }
        },
        element : {
            get : function() {
                return this._element;
            },
            set : function(value) {
                var oldValue = this._element;

                if (oldValue === value) {
                    return;
                }

                if (defined(oldValue)) {
                    oldValue.removeEventListener("seeked", this._seekFunction, false);
                }

                if (defined(value)) {
                    this._seeking = false;
                    this._seekFunction = createSeekFunction(this);
                    value.addEventListener("seeked", this._seekFunction, false);
                }

                this._element = value;
            }
        }
    });

    VideoSynchronizer.prototype.destroy = function() {
        this.element = undefined;
        this.clock = undefined;
        return destroyObject(this);
    };

    VideoSynchronizer.prototype.isDestroyed = function() {
        return false;
    };

    VideoSynchronizer.prototype._onTick = function(clock) {
        var element = this._element;
        if (!defined(element) || element.readyState < 2) {
            return;
        }

        var paused = element.paused;
        var shouldAnimate = clock.shouldAnimate;
        if (shouldAnimate === paused) {
            if (shouldAnimate) {
                element.play();
            } else {
                element.pause();
            }
        }

        if (this._seeking) {
            return;
        }

        var multiplier = clock.multiplier;
        element.playbackRate = multiplier;

        var clockTime = clock.currentTime;
        var epoch = defaultValue(this.epoch, Iso8601.MINIMUM_VALUE);
        var videoTime = JulianDate.secondsDifference(clockTime, epoch);

        var duration = element.duration;
        var desiredTime;
        var currentTime = element.currentTime;
        if (element.loop) {
            videoTime = videoTime % duration;
            if (videoTime < 0.0) {
                videoTime = duration - videoTime;
            }
            desiredTime = videoTime;
        } else if (videoTime > duration) {
            desiredTime = duration;
        } else if (videoTime < 0.0) {
            desiredTime = 0.0;
        } else {
            desiredTime = videoTime;
        }

        //If the playing video's time and the scene's clock
        //time ever drift too far apart, we want to set the video
        //to match
        var tolerance = shouldAnimate ? 0.15 : 0.001;

        //At certain speeds or when scrubbing the timeline, seeking
        //takes to long and we end up constantly seeking without
        //ever actually playing the video, this limits seeks to only
        //occur every 100 ms.
        var now = Date.now();
        var lastSeek = this._lastSeek;
        var shouldSeek = ((now - lastSeek) > 100);

        if (Math.abs(desiredTime - currentTime) > tolerance && shouldSeek) {
            this._seeking = true;
            this._lastSeek = now;
            element.currentTime = desiredTime;
        }
    };

    function createSeekFunction(that) {
        return function() {
            that._seeking = false;
        };
    }

    return VideoSynchronizer;
});
