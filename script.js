const SPOTIFY_CLIENT_ID = 'bfcd4af94e774f3992f578aa3dfddd02';
// const REMOTE_SPOTIFY_REDIRECT_URI = 'http://localhost:8000/?refresh';
const REMOTE_SPOTIFY_REDIRECT_URI = 'https://pflouret.github.io/spotirand/?refresh';

"use strict";
var accessToken = null;
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

function authorizeUser() {
  document.location = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=token&scope=user-library-read&redirect_uri=${encodeURIComponent(REMOTE_SPOTIFY_REDIRECT_URI)}`;
}

function fetchCurrentUserProfile(callback) {
  callSpotify('https://api.spotify.com/v1/me', null, 'GET', callback);
}
function fetchSavedAlbums(offset, callback) {
  callSpotify(('https://api.spotify.com/v1/me/albums?limit=50&offset=' + offset), {}, 'GET', callback);
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
  window.localStorage.setItem("albums", JSON.stringify(albums, null, 2));
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
      'Authorization': `Bearer ${accessToken}`
    },
    success: (r) => { callback(r); },
    error: (r) => {
      if (r.status == '502' || r.status == '500') {
        console.log('502 or 500 Error. Trying again');
        callSpotify(url, data, method, callback);
      } else {
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
  if (!refreshAlbums && "albums" in window.localStorage) {
    albums = _.shuffle(JSON.parse(window.localStorage["albums"]));
    buildSlider(0);
    return;
  }

  const args = new URLSearchParams(window.location.hash.substring(1));
  if (args.has('access_token')) {
    accessToken = args.get('access_token');
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
  } else {
    authorizeUser();
  }
});
