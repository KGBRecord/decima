export default defineUnlistedScript(() => {
var imgs = document.querySelectorAll<HTMLImageElement>(
  'div[data-animate-status-v3-viewer="true"] img',
);
if (imgs.length >= 3) {
  let storyUrl = imgs[imgs.length - 1].src;
  let username =
    (
      (imgs[0].parentElement!.parentElement!.nextSibling as Element)
        .children[0] as HTMLElement
    ).innerText;
  chrome.runtime.sendMessage(null, {
    site: "whatsapp",
    username: username,
    url: storyUrl + "#.jpg",
  });
} else {
  chrome.runtime.sendMessage(null, { noStories: true });
}

});
