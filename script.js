const DEV = false;
const SPOTIFY_CLIENT_ID = 'bfcd4af94e774f3992f578aa3dfddd02';
const REMOTE_SPOTIFY_REDIRECT_URI = DEV ? 'http://127.0.0.1:8000/?refresh' : 'https://pflouret.github.io/spotirand/?refresh';
const SCOPES = "user-library-read user-follow-read";

"use strict";
var albums = [];
var albnum = 0;

function error(msg) {
  $("#info-error").html(msg);
  if (msg == '') {
    $("#info-error").addClass('hidden');
  } else {
    $("#info-error").removeClass('hidden');
  }
}

const generateRandomString = (length) => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

const sha256 = async (plain) => {
  const data = new TextEncoder().encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
};

const base64encode = (input) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const authorizeUser = async () => {
  const codeVerifier = generateRandomString(64);
  localStorage.setItem("code_verifier", codeVerifier);

  const params = {
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    SCOPES,
    code_challenge_method: "S256",
    code_challenge: base64encode(await sha256(codeVerifier)),
    redirect_uri: REMOTE_SPOTIFY_REDIRECT_URI,
  };

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
};

const getToken = async (code) => {
  const url = "https://accounts.spotify.com/api/token";
  const payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REMOTE_SPOTIFY_REDIRECT_URI,
      code_verifier: localStorage.getItem("code_verifier")
    }),
  };

  const response = await fetch(url, payload);
  const body = await response.json();

  if (response.ok) {
    localStorage.setItem("access_token", body.access_token);
    if (body.refresh_token) {
      localStorage.setItem('refresh_token', body.refresh_token);
    }
  }
};

const refreshToken = async () => {
  if (!'refresh_token' in localStorage) {
    return false;
  }

  const refreshToken = localStorage.getItem('refresh_token');

  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: SPOTIFY_CLIENT_ID
    }),
  };
  const response = await fetch("https://accounts.spotify.com/api/token", payload);
  const body = await response.json();

  if (response.ok) {
    localStorage.setItem('access_token', body.access_token);
    if (body.refresh_token) {
      localStorage.setItem('refresh_token', body.refresh_token);
    }
  }

  return response.ok;
};

function fetchCurrentUserProfile(callback) {
  callSpotify("https://api.spotify.com/v1/me", null, "GET", callback);
}
function fetchSavedAlbums(offset, callback) {
  callSpotify(("https://api.spotify.com/v1/me/albums?limit=50&offset=" + offset), {}, "GET", callback);
}

function collectAlbums(albumsResponse) {
  _.each(albumsResponse.items, (item) => {
    if (item.album
      && item.album?.total_tracks
      && item.album?.artists[0]?.name
      && item?.album?.name
      && item.album?.uri
      && item.album?.images[0]?.url) {
      console.log('loaded: ' + item.album.artists[0].name + ' - ' + item.album.name);
      albums.push({
        artistName: item.album.artists[0].name,
        albumName: item.album.name,
        albumURL: item.album.uri,
        packshot: item.album.images[0].url,
      });
    } else {
      console.log('error getting all details for: ' + item.album.artists[0].name + ' - ' + item.album.name);
    }

  });

  if (albumsResponse.next) {
    callSpotify(albumsResponse.next, {}, 'GET', (response) => { collectAlbums(response) });
  } else {
    console.log('total albums: ' + albums.length);

    $('.loadhidden').removeClass('hidden');
    $('.loadingmessage').addClass('hidden');

    albums = _.shuffle(albums);
    buildSlider(0);
    saveAlbums();
  }
}

function saveAlbums() {
  localStorage.setItem("albums", JSON.stringify(albums, null, 2));
}

function buildSlider(batchnum) {
  if (albnum <= albums.length) {
    const batchArray = albums.slice(batchnum, batchnum + 20);
    _.each(batchArray, (alb) => {
      albnum = albnum + 1;
      const artistAlbum = alb.artistName + ' - ' + alb.albumName;
      $('.albumslist').slick(
        'slickAdd',
        `<div class="albumsuggestion album${albnum}">
          <div class=packshot data-album="${artistAlbum}" data-albumartist="${alb.artistName} data-albumnum="${albnum}>
            <img class="img-thumbnail" src="${alb.packshot}">
            <a class="btn-play" href="${alb.albumURL}" data-album="${artistAlbum}" data-albumartist="${alb.artistName}" data-albumnum="${albnum}">
              <i class="fa fa-play-circle" aria-hidden="true"></i>
            </a>
          </div>
          <h4 class="artistname">${alb.artistName}</h4>
          <h4 class="albumname">${alb.albumName}</h4>
        </div>`);
    });
  }
}

function callSpotify(url, data, method, callback) {
  $.ajax(url, {
    type: method,
    dataType: 'json',
    data: data,
    headers: {
      'Authorization': `Bearer ${localStorage.getItem("access_token")}`
    },
    success: (r) => { callback(r); },
    error: (r) => {
      if (r.status == '502' || r.status == '500') {
        console.log('502 or 500 Error. Trying again');
        callSpotify(url, data, method, callback);
      } else {
        localStorage.removeItem("access_token");
        callback(null);
        error(r.responseJSON.error.status + ': ' + r.responseJSON.error.message + '<br/><a href="">Go back and try again</a>.');
        console.log(r);
      }
    }
  });
}

$(document).ready(() => {
  $('.albumslist').slick({ 'mobileFirst': true });

  $('.albumslist').on('beforeChange', (event, slick, currentSlide, nextSlide, direction) => {
    if (nextSlide == albnum - 1) {
      buildSlider(albnum);
    }
  });

  const refreshAlbums = new URLSearchParams(window.location.search).has("refresh");
  if (!DEV && !refreshAlbums && "albums" in localStorage) {
    albums = _.shuffle(JSON.parse(localStorage["albums"]));
    buildSlider(0);
    return;
  }

  if (localStorage.getItem("access_token")) {
    handlePostAuth();
    return;
  }

  const args = new URLSearchParams(window.location.search);
  if (args.has('code')) {
    let code = args.get('code');
    getToken(code).then(handlePostAuth);
  } else {
    refreshToken().then((ok) => ok ? handlePostAuth() : authorizeUser())
  }
});

function handlePostAuth() {
  if (DEV) {
    console.log(localStorage.getItem("access_token"));
    history.pushState("", document.title, window.location.pathname);
    return;
  }

  fetchCurrentUserProfile((user) => {
    if (user) {
      $('.loadingmessage').removeClass('hidden');
      fetchSavedAlbums(0, (data) => {
        if (data) {
          collectAlbums(data);
        } else {
          error('Trouble getting your saved albums<br/><a href="">Go back and try again</a>.');
        }
      });
      history.pushState("", document.title, window.location.pathname);
    } else {
      error('Trouble getting the user profile. <a href="">Go back and try again</a>.');
    }
  });
}
