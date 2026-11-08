export default defineUnlistedScript(() => {
var profile_pic = document.querySelector<HTMLImageElement>(
  "a[role=link][tabindex='0'][href*='https://www.facebook']>img",
);
var story = document.querySelectorAll<HTMLImageElement>("img[draggable=false]");

if (profile_pic != null && (top as Window).location.toString().indexOf("stories") != -1) {
  let videos = document.querySelectorAll("video");
  let video: HTMLVideoElement | null = null;
  for (let i = 0; i < videos.length; i++) {
    if (videos[i].offsetHeight !== 0) video = videos[i];
  }

  let username = profile_pic.alt;
  if (video !== null) {
    window.postMessage("CALLVIDEO", "*");
  } else {
    savePhotoStory(profile_pic);
  }
} else {
  chrome.runtime.sendMessage(null, { noStories: true });
}
function savePhotoStory(pic: HTMLImageElement) {
  const storyImg = story[0];
  storyImg.innerHTML = storyImg.innerHTML += "<h1>download</h1>>";
  let storyUrl = storyImg.src;
  let username = pic.alt;

  chrome.runtime.sendMessage(
    { downloadv1: storyUrl, idx: username, url: location.href },
    (response) => {
      console.log("dow:");
    },
  );
}

});
