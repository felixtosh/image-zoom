var Emitter = require('emitter');
var classes = require('classes');
var transform = require('transform-property');
var redraw = require('redraw');
var events = require('events');
var afterTransition = require('after-transition');
var is = require('is');
var scale = require('scale-to-bounds');
var viewport = require('viewport');
var has3d = require('has-translate3d');
var overlay = require('overlay');
var delegate = require('delegate');

/**
 * Create the supported translate string.
 * @param  {Int} x coordinate
 * @param  {Int} y coordinate
 * @return {String}
 */

function translateString(x, y){
  return has3d
    ? 'translate3d('+ x +'px, '+ y +'px, 0)'
    : 'translate('+ x +'px, '+ y + 'px)';
}

/**
 * Bootstrap-style API that allows designers to invoke zooming
 * the element using markup
 */

var bnd = delegate.bind(document, '[data-zoom-url]', 'click', function(e){
  var z = new Zoom(e.target);
  z.show();
});



/**
 * Javascript API. Pass in either an element or list
 * of elements, plus the optional URL of the image.
 * @param  {Element} el
 * @param  {String} url
 * @return {Zoom}
 */

module.exports = function(el, url){
  delegate.unbind(document, 'click', bnd, false);
  if (is.object(el)){
    var zooms = [];
    for (var i = 0; i < el.length; i++){
      zooms.push(new Zoom(el[i]).bind());
    }
    return zooms;
  }
  return new Zoom(el, url).bind();
}

/**
 * Zoom Constructor
 * @param {Element} el
 * @param {String} url
 */

var Zoom = function(el, url){
  this.thumb = el;
  if (this.thumb.getAttribute('data-zoom-overlay')){
    this.overlay();
  }
  this.backgroundURL = url;
  this.viewport = {};
};

Emitter(Zoom.prototype);

/**
 * Bind zoom click event.
 * @return {Zoom}
 */

Zoom.prototype.bind = function(){
  this.events = events(this.thumb, this);
  this.events.bind('click', 'show');
  return this;
};

/**
 * Enable overlay.
 * @return {Zoom}
 */

Zoom.prototype.overlay = function(){
  this._overlay = overlay();
  return this;
};

/**
 * While our image is loading, we add a loading
 * class to our target element.
 * @param  {Function} fn
 */

Zoom.prototype.loadImage = function(fn){
  if (this.hasLoaded) return fn();
  var img = this.clone = new Image();
  var self = this;
  setTimeout(function(){
    if (!self.hasLoaded) self.loading();
  }, 50);
  img.onload = function(){
    self.hasLoaded = true;
    self.finishLoading();
    self.imageWidth = img.width;
    self.imageHeight = img.height;
    fn();
  };
  img.src = this.src;
};

Zoom.prototype.loading = function(){
  classes(this.thumb).add('loading');
};

Zoom.prototype.finishLoading = function(){
  classes(this.thumb).remove('loading');
};

Zoom.prototype.getDimensions = function(fn){
  var pos = this.thumb.getBoundingClientRect();
  this.origin = {
    x : pos.left,
    y : pos.top,
    w : this.thumb.clientWidth,
    h : this.thumb.clientHeight
  };
  this.src = this.thumb.getAttribute('data-zoom-url') || this.backgroundURL;
  return this;
};

Zoom.prototype.appendClone = function(){
  classes(this.clone).add('zoom-image-clone');
  this.cloneEvents = events(this.clone, this);
  this.cloneEvents.bind('click', 'hide');
  this.windowEvents = events(window, this);
  this.windowEvents.bind('resize');
  document.body.appendChild(this.clone);
  return this;
};

// Debounce this?
Zoom.prototype.onresize = function(){
  this.determineZoomedSize();
  this.updateStyles();
};

// optional padding?
Zoom.prototype.determineZoomedSize = function(){
  // image size
  var clone = this.clone;
  var iw = this.imageWidth;
  var ih = this.imageHeight;

  // viewport size
  var vp = viewport();

  // zoomed image max size
  var target = scale(iw, ih, vp.width, vp.height);

  // determine left & top position of zoomed image
  var left = (vp.width / 2) - (target.width / 2);
  var top = (vp.height / 2) - (target.height / 2);

  this.target = {
    x : left,
    y: top,
    w: target.width,
    h: target.height
  };

  return this;
};

Zoom.prototype.updateStyles = function(){
  var t = this.target;
  var s = this.clone.style;
  s.width = t.w + 'px';
  s.height = t.h + 'px';
  s.left = t.x + 'px';
  s.top = t.y + 'px';
}

Zoom.prototype.setOriginalDeminsions = function(){
  var o = this.origin;
  var t = this.target;
  this.updateStyles();

  if (transform){
    var scale = o.w / t.w;
    var translateX = (o.x + (o.w / 2)) - (t.x + (t.w / 2));
    var translateY = (o.y + (o.h / 2)) - (t.y + (t.h / 2));
    var translate3d = translateString(translateX, translateY);
    var scale = ' scale('+ scale +')';
    this.clone.style[transform] = translate3d + scale;
  }
  return this;
};


Zoom.prototype.setTargetPosition = function(){
  if (transform){
    this.clone.style[transform] = translateString(0, 0) + ' scale(1)';
  }
  return this;
}

Zoom.prototype.show = function(e){
  if (e) e.preventDefault();
  this.getDimensions();
  var self = this;
  this.loadImage(function(){
    self.emit('showing');
    if (self._overlay) {
      self._overlay.show();
    }
    self.determineZoomedSize();
    self.setOriginalDeminsions();
    self.appendClone();
    redraw(self.clone);
    self.setTargetPosition();
    afterTransition.once(self.clone, function(){
      self.emit('shown');
    });
  });
};

Zoom.prototype.hide = function(e){
  if (e) e.preventDefault();
  this.cloneEvents.unbind();
  this.windowEvents.unbind();
  this.setOriginalDeminsions();
  var self = this;
  self.emit('hiding');
  if (self._overlay) {
    self._overlay.hide();
  }
  afterTransition.once(self.clone, function(){
    self.clone.parentNode.removeChild(self.clone);
    self.emit('hidden');
  });
  return this;
}
