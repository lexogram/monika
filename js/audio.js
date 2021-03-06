;(function (monika){

  if (!monika) {
    monika = window.monika = {}
  }

  function Audio() {
    let audio = this.audioPreloader = document.createElement("audio")
    this.audioElement = document.querySelector("audio")
    this.audioElement.onended = (event) => {
      this._playNext(event)
    }

    // List of files to preload and that have been loaded
    this.queue   = []
    this.loaded  = []
    this.missing = []

    // Currently playing sound and status, and next to play
    this.src     = ""
    this.isBusy  = false
    this.nextUp  = { src: [], callback: null }

    // File type to request from server
    this.ext = "" // will be set to .mp3 or .ogg

    this.debug = false

    let audioTypes = {
      ".mp3":  "audio/mpeg"
    , ".ogg":  "audio/ogg"
    // , ".mp4":  "audio/mp4"
    // , ".aac":  "audio/aac"
    // , ".aacp": "audio/aacp"
    // , ".webm": "audio/webm"
    // , ".webm": "audio/webm"
    // , ".flac": "audio/flac"
    // , ".wav":  "audio/wav"
    }

    if (this.audioPreloader.canPlayType) {
      for (let type in audioTypes) {
        let audioType = audioTypes[type]
        let canPlay = audio.canPlayType(audioType).replace(/no/, '')

        if (canPlay) {
          this.ext = type
          // log("Can play: " + type)
          break
        }
      }
    } // else ?? there will be no sound at all. Warn?
  }



  /**
   * Sent by <level> at the beginning of a newChallenge()
   *         <level> from treatTap() each time the player taps a good
   *                 item.
   *
   * When sent by newChallenge() there should, by design, be no sound
   * currently playing. When sent by treatTap, the current sound may
   * not have finished, so the new sound must either be discarded or
   * delayed.
   * - If it is the same src, then it can be discarded.
   * - If it is a different src (number|consonant|word) then it should
   *   be played.
   * - If it is the last tap, callback will be a function. The sound
   *   need not be played if it is a duplicate.
   *   
   * @param  {string}   src      relative url, with no extension
   * @param  {Function} callback null or a callback that will trigger
   *                             the next challenge
   */
  Audio.prototype.play = function play(src, callback) {
    // log(src + " (callback: " + (typeof callback === "function"
    //                          ? "FUNCTION"
    //                          : callback
    //                            ? callback
    //                            : "null") +")")
    
    this.nextUp.callback = callback

    if (this._pretendToPlay(src)) {
      return
    }

    if (this.isBusy) {
      if (this.src !== src) {
        this.nextUp.src.push(src)
      } // else just drop the duplicate sound

      return
    }

    // If we get here, then we want to play this sound ... but it
    // might not be loaded yet.

    this._prepareToPlay(src)
  }



  Audio.prototype._pretendToPlay = function _pretendToPlay(src) {
    let placeholder =  document.querySelector("aside")

    if (src[0] !== "&") {
      placeholder.innerHTML =""
      return false
    }

    // No audio available. Just show text in the <aside>

    if (!this.colours || !this.colours.length) {
      this.colours = ["red", "orange", "yellow", "3f3", "cyan", "#3f3", "magenta"]
    }

    placeholder.innerHTML = src
    placeholder.style.color = this.colours.pop()

    setTimeout(() => {
      placeholder.innerHTML = ""
    }, 1000)
    
    if (this.nextUp.callback) {
      this.nextUp.callback()
    }

    return true
  }


  Audio.prototype._prepareToPlay = function _prepareToPlay(src) {
    if (this.loaded.indexOf(src) < 0) {
      // this.isBusy is currently false. Use this audio element to
      // load this file. But if another request to _prepareToPlay is
      // received, the current src file will be replaced.

      this.audioElement.oncanplaythrough = this._processed.bind(this)
      this.audioElement.onerror = this._playNext.bind(this)
    }
 
    this.audioElement.src = src + this.ext
    let promise = this.audioElement.play() // may be asynchronous
    
    this.src = src
    this.isBusy = true // a second call for the same src won't trigger
   
    // // When the file has finished playing, it will call _playNext, to
    // // see if anything has queued up in the meantime
  }



  /** 
   * Called each time audioElement finishes playing, or if it fails
   * to play a particular src.
   */
  Audio.prototype._playNext = function _playNext(event) {
    this.isBusy = false

    let src = this.nextUp.src.shift()
    let callback = this.nextUp.callback

    if (src) {
      this._prepareToPlay(src)

    } else if (callback) {
      // this.isBusy will be false while the callback is executing
      callback()
      this.nextUp.callback = null
    }
  }



  Audio.prototype.preload = function preload(srcArray, callback) {
    // Adds urls in srcArray in reverse order, so that the first src
    // in srcArray will be the first to be popped. If any urls are
    // already in the array, they will be re-orderd in a priority
    // position.

    // TODO? Apply callback to each batch, so that the app knows when
    // all requested files have become available

    _startPreload = () => {
      this.audioPreloader.oncanplaythrough = _loadNext
      this.audioPreloader.onerror = _loadNext

      this.audioPreloader.src = this.queue.pop()
    }

    _loadNext = (event) => {
      let src = this._processed(event)

      while (this.loaded.indexOf(src) > -1) {
        src = this.queue.pop()
      }

      if (src) {
        this.audioPreloader.src = src
      } else {
        this.audioPreloader.oncanplaythrough = null
        this.audioPreloader.onerror = null
      }
    }

    let ii = srcArray.length

    while (ii--) {
      let src = srcArray[ii]

      if (this.loaded.indexOf(src) < 0 ) {
        src += this.ext
        let index = this.queue.indexOf(src)

        if (index < 0) {
        } else if (index = this.queue.length - 1) {
          continue
        } else {
          // Move this src to the (current) head of the queue
          this.queue.splice(index, 1)
        }

        this.queue.push(src)
      }
    }

    if (this.queue.length && !this.audioPreloader.oncanplaythrough) {
      _startPreload()
    }
  }



  Audio.prototype._processed = function _processed(event) {
    let src = event.target.src   
    src = decodeURIComponent(src)
    src = src.match(/\/monika\/.*$/)[0]
    src = src.substring(0, src.lastIndexOf("."))

    if (event.type === "error") {
      this.missing.push(src) 
      return  log("Error: missing" + src)
    }

    // Trim domain and extension

    if (this.loaded.indexOf(src) < 0) {
      this.loaded.push(src)
      // log(src + " added to .loaded list")
    }


    return src
  }
  


  monika.audio = new Audio()

})(window.monika)