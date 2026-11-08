import type { DownloadProgress } from './types';
import { fetchProfilePostsViaAPI, getProfileUsername, getUserPostCount } from './profile-api';
import { state } from './state';

/**
 * Check if the current page is a profile page and add download button
 */
export function checkForProfilePage() {
  // Profile pages match this pattern: instagram.com/username
  // But not: instagram.com/p/..., instagram.com/stories/..., instagram.com/explore/...
  const isProfilePage =
    /instagram\.com\/(?!p\/|stories\/|explore\/)[^\/]+\/?$/.test(location.href);

  if (isProfilePage && !state.isProcessingProfile) {
    addProfileDownloadButton();
  }
}

/**
 * Add a download button to profile pages
 */
export function addProfileDownloadButton() {
  // Check if button already exists
  if (document.querySelector<HTMLElement>(".eph_toolkit_profile_download_btn")) {
    return;
  }

  // Try to find header section or appropriate container for the button
  const header =
    document.querySelector<HTMLElement>("header section") ||
    document.querySelector<HTMLElement>("header") ||
    document.querySelector<HTMLElement>("section main header");

  if (!header) return;

  // Create profile download button
  const downloadBtn = document.createElement("div");
  downloadBtn.className = "eph_toolkit_profile_download_btn";
  downloadBtn.innerHTML = `
        <span class="eph_toolkit_icon"></span>
        <span class="eph_toolkit_text">Download All</span>
    `;
  downloadBtn.style.cssText = `
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 8px 16px;
        background-color: #0095f6;
        color: white;
        border-radius: 4px;
        margin-top: 12px;
        font-weight: bold;
    `;

  // Add click handler
  downloadBtn.addEventListener("click", handleProfileDownload);

  // Add to page
  header.appendChild(downloadBtn);
}

export function showProgressBar(buttonElement: HTMLElement, percentage: number, statusText?: string): void {
  // Create progress bar container if it doesn't exist
  if (!buttonElement.querySelector<HTMLElement>(".eph_toolkit_progress_container")) {
    buttonElement.innerHTML = `
            <div class="eph_toolkit_status">${statusText}</div>
            <div class="eph_toolkit_progress_container" style="width: 100%; height: 4px; background-color: #efefef; border-radius: 2px; margin-top: 5px; overflow: hidden;">
                <div class="eph_toolkit_progress_bar" style="width: ${percentage}%; height: 100%; background-color: #0095f6; transition: width 0.3s ease;"></div>
            </div>
        `;
  } else {
    // Update existing progress bar
    const progressBar = buttonElement.querySelector<HTMLElement>(
      ".eph_toolkit_progress_bar",
    );
    const statusElement = buttonElement.querySelector<HTMLElement>(".eph_toolkit_status");

    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }

    if (statusElement) {
      statusElement.textContent = statusText as string;
    }
  }
}
// Function to create and show a filter popup with post count
export function showFilterPopup(buttonElement: HTMLElement, username: string, totalPosts: number): void {
  // Overlay (giữ class cũ để closeFilterPopup hoạt động)
  const overlay = document.createElement("div");
  overlay.className = "eph_toolkit_overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;";

  const popup = document.createElement("div");
  popup.className = "eph_toolkit_popup";
  popup.style.cssText = "all:initial;";

  const defTo = Math.min(totalPosts, 20);
  const todayStr = new Date().toISOString().slice(0, 10);

  popup.innerHTML = `
<style>
.eph-modal,.eph-modal *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.eph-modal{width:460px;max-width:100%;max-height:90vh;overflow-y:auto;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.3);color:#1f2937;}
.eph-head{display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid #eef0f3;}
.eph-head-icon{width:44px;height:44px;border-radius:12px;background:#e8f0fe;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
.eph-head-text{flex:1;}
.eph-title{font-size:19px;font-weight:700;color:#111827;line-height:1.2;}
.eph-sub{font-size:13px;color:#6b7280;margin-top:2px;}
.eph-close{cursor:pointer;color:#9ca3af;font-size:22px;line-height:1;padding:4px;border-radius:8px;}
.eph-close:hover{background:#f3f4f6;color:#374151;}
.eph-body{padding:18px 20px 4px;}
.eph-info{display:flex;align-items:center;gap:14px;background:#eef5ff;border:1px solid #dce8fb;border-radius:12px;padding:16px 18px;margin-bottom:18px;}
.eph-info-icon{width:40px;height:40px;border-radius:10px;background:#dbeafe;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
.eph-info-num{font-size:30px;font-weight:800;color:#2563eb;vertical-align:middle;}
.eph-info-txt{font-size:15px;color:#374151;margin-left:6px;}
.eph-sec{border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid;}
.eph-sec-blue{background:#f5f9ff;border-color:#e1ecfb;}
.eph-sec-pink{background:#fff5f8;border-color:#fbdde8;}
.eph-sec-title{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;margin-bottom:14px;}
.eph-blue{color:#2563eb;}
.eph-pink{color:#db2777;}
.eph-range{display:flex;align-items:center;gap:14px;}
.eph-num{flex:1;border:1px solid #d1d5db;border-radius:10px;padding:12px 14px;font-size:16px;text-align:center;background:#fff;color:#111827;outline:none;}
.eph-num:focus{border-color:#2563eb;}
.eph-to-lbl{color:#6b7280;font-size:14px;}
.eph-hint{font-size:12px;color:#9ca3af;margin-top:8px;}
.eph-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.eph-row:last-child{margin-bottom:0;}
.eph-chk-row{flex:1;display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;color:#374151;user-select:none;}
.eph-chk-row input[type=checkbox]{width:18px;height:18px;accent-color:#db2777;cursor:pointer;}
.eph-chk-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
.eph-pink-bg{background:#fce7f0;}
.eph-purple-bg{background:#ede9fe;}
.eph-spin{width:78px;border:1px solid #d1d5db;border-radius:8px;padding:9px 10px;font-size:15px;text-align:center;background:#fff;color:#111827;outline:none;}
.eph-spin:focus{border-color:#db2777;}
.eph-filter-row{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;margin-bottom:10px;}
.eph-f-icon{width:26px;height:26px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
.eph-f-label{font-size:14px;color:#374151;width:120px;flex:0 0 auto;}
.eph-finput{flex:1;min-width:0;border:1px solid #e5e7eb;border-radius:8px;padding:9px 10px;font-size:13px;background:#fff;color:#111827;outline:none;}
.eph-finput:focus{border-color:#2563eb;}
.eph-foot{display:flex;gap:12px;padding:8px 20px 18px;}
.eph-cancel,.eph-download{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;border:none;}
.eph-cancel{background:#fff;color:#374151;border:1px solid #e5e7eb;}
.eph-cancel:hover{background:#f9fafb;}
.eph-download{background:#2563eb;color:#fff;}
.eph-download:hover{background:#1d4ed8;}
.eph-secure{display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:#9ca3af;padding:0 20px 18px;}
</style>
<div class="eph-modal">
  <div class="eph-head">
    <div class="eph-head-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2.5h8.5A1.5 1.5 0 0 1 21 10v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M12 11.5v5"/><path d="m9.8 14.6 2.2 2.2 2.2-2.2"/></svg>
    </div>
    <div class="eph-head-text">
      <div class="eph-title">Ephemera</div>
      <div class="eph-sub">Download all posts</div>
    </div>
    <div class="eph-close">&times;</div>
  </div>
  <div class="eph-body">
    <div class="eph-info">
      <div class="eph-info-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h4"/></svg>
      </div>
      <div><span class="eph-info-num">${totalPosts}</span><span class="eph-info-txt">posts available for download</span></div>
    </div>

    <div class="eph-sec eph-sec-blue">
      <div class="eph-sec-title eph-blue">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M8 14h3M13 14h3"/></svg>
        1. Download posts range
      </div>
      <div class="eph-range">
        <input class="eph-from eph-num" type="number" min="1" max="${totalPosts}" value="1">
        <span class="eph-to-lbl">to</span>
        <input class="eph-to eph-num" type="number" min="1" max="${totalPosts}" value="${defTo}">
      </div>
      <div class="eph-hint">Enter the range of posts you want to download</div>
    </div>

    <div class="eph-sec eph-sec-pink">
      <div class="eph-sec-title eph-pink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="m9.5 15 2 2 3.5-3.5"/></svg>
        2. Sort and select top posts (optional)
      </div>
      <div class="eph-row">
        <label class="eph-chk-row">
          <input type="checkbox" class="eph-top-like-chk">
          <span class="eph-chk-icon eph-pink-bg"><svg width="16" height="16" viewBox="0 0 24 24" fill="#db2777" stroke="none"><path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.8c0 5.4-7.5 10-7.5 10z"/></svg></span>
          Download by top LIKE
        </label>
        <input class="eph-top-like-cnt eph-spin" type="number" min="1" value="3">
      </div>
      <div class="eph-row">
        <label class="eph-chk-row">
          <input type="checkbox" class="eph-top-cmt-chk">
          <span class="eph-chk-icon eph-purple-bg"><svg width="16" height="16" viewBox="0 0 24 24" fill="#7c3aed" stroke="none"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/></svg></span>
          Download by top CMT
        </label>
        <input class="eph-top-cmt-cnt eph-spin" type="number" min="1" value="3">
      </div>
    </div>

    <div class="eph-sec eph-sec-blue">
      <div class="eph-sec-title eph-blue">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h11M4 17h6"/></svg>
        3. Additional filters (optional)
      </div>
      <div class="eph-filter-row">
        <span class="eph-f-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h4v9H4z"/><path d="M8 11l3.2-6.2a1.8 1.8 0 0 1 3.3 1.3L13.8 10H18a2 2 0 0 1 2 2.4l-1.3 6a2 2 0 0 1-2 1.6H8"/></svg></span>
        <span class="eph-f-label">Likes Range</span>
        <input class="eph-likes-min eph-finput" type="number" min="0" placeholder="Min">
        <span class="eph-to-lbl">to</span>
        <input class="eph-likes-max eph-finput" type="number" min="0" placeholder="Max">
      </div>
      <div class="eph-filter-row">
        <span class="eph-f-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/></svg></span>
        <span class="eph-f-label">Comments Range</span>
        <input class="eph-cmt-min eph-finput" type="number" min="0" placeholder="Min">
        <span class="eph-to-lbl">to</span>
        <input class="eph-cmt-max eph-finput" type="number" min="0" placeholder="Max">
      </div>
      <div class="eph-filter-row">
        <span class="eph-f-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg></span>
        <span class="eph-f-label">Date Range</span>
        <input class="eph-date-from eph-finput" type="date" placeholder="dd/mm/yyyy">
        <span class="eph-to-lbl">to</span>
        <input class="eph-date-to eph-finput" type="date" value="${todayStr}">
      </div>
      <div class="eph-hint" style="text-align:center">Leave empty to include all</div>
    </div>
  </div>
  <div class="eph-foot">
    <button class="eph-cancel"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>Cancel</button>
    <button class="eph-download"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/></svg>Download Posts</button>
  </div>
  <div class="eph-secure">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7.5 3v5.5c0 4.4-3.2 7.7-7.5 9.5-4.3-1.8-7.5-5.1-7.5-9.5V6z"/><path d="m8.8 12 2.4 2.4 4-4.4"/></svg>
    Your data is secure and will only be used for download.
  </div>
</div>`;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  const $ = (sel: string) => popup.querySelector<HTMLElement>(sel) as HTMLElement;

  function close() {
    closeFilterPopup();
    state.isProcessingProfile = false;
  }
  $(".eph-close").onclick = close;
  $(".eph-cancel").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // Ràng buộc range
  const from = $(".eph-from") as HTMLInputElement,
    to = $(".eph-to") as HTMLInputElement;
  from.addEventListener("change", () => {
    let f = parseInt((from as HTMLInputElement).value);
    if (isNaN(f) || f < 1) (from as HTMLInputElement).value = "1";
    if (parseInt((from as HTMLInputElement).value) > totalPosts) (from as HTMLInputElement).value = totalPosts.toString();
    if (parseInt((from as HTMLInputElement).value) > parseInt((to as HTMLInputElement).value || String(totalPosts)))
      (to as HTMLInputElement).value = (from as HTMLInputElement).value;
  });
  to.addEventListener("change", () => {
    let t = parseInt((to as HTMLInputElement).value);
    if (isNaN(t) || t < 1) (to as HTMLInputElement).value = "1";
    if (parseInt((to as HTMLInputElement).value) > totalPosts) (to as HTMLInputElement).value = totalPosts.toString();
    if (parseInt((to as HTMLInputElement).value) < parseInt((from as HTMLInputElement).value || "1")) (from as HTMLInputElement).value = (to as HTMLInputElement).value;
  });

  $(".eph-download").onclick = () => {
    state.isProcessingProfile = true;
    const num = (sel: string) => {
      const v = ($(sel) as HTMLInputElement).value;
      return v !== "" ? parseInt(v) : null;
    };
    const filters = {
      postsRange: {
        from: parseInt((from as HTMLInputElement).value) || 1,
        to: parseInt((to as HTMLInputElement).value) || totalPosts,
      },
      likes: { min: num(".eph-likes-min"), max: num(".eph-likes-max") },
      comments: { min: num(".eph-cmt-min"), max: num(".eph-cmt-max") },
      date: {
        from: ($(".eph-date-from") as HTMLInputElement).value ? ($(".eph-date-from") as HTMLInputElement).value : null,
        to: ($(".eph-date-to") as HTMLInputElement).value ? ($(".eph-date-to") as HTMLInputElement).value : null,
      },
      sorting: {
        mostLikes: ($(".eph-top-like-chk") as HTMLInputElement).checked
          ? parseInt(($(".eph-top-like-cnt") as HTMLInputElement).value) || 3
          : null,
        mostComments: ($(".eph-top-cmt-chk") as HTMLInputElement).checked
          ? parseInt(($(".eph-top-cmt-cnt") as HTMLInputElement).value) || 3
          : null,
      },
    };
    closeFilterPopup();
    localStorage.setItem("eph_toolkit_filters", JSON.stringify(filters));
    sessionStorage.setItem("eph_toolkit_filters", JSON.stringify(filters));
    showProgressBar(buttonElement, 0, "Preparing download...");
    fetchProfilePostsViaAPI.call(undefined); // plain call: `this` is undefined in a strict module
  };
}
// Function to close the filter popup
export function closeFilterPopup() {
  const overlay = document.querySelector<HTMLElement>(".eph_toolkit_overlay");
  const popup = document.querySelector<HTMLElement>(".eph_toolkit_popup");

  if (overlay) overlay.remove();
  if (popup) popup.remove();
}
export function handleDownloadProgress(progressData: DownloadProgress): void {
  // Tìm các nút tải xuống đang hoạt động
  const downloadButton = document.querySelector<HTMLElement>(
    ".eph_toolkit_profile_download_btn",
  );
  if (!downloadButton) return;

  // Tính toán phần trăm tiến trình
  const percentage = Math.round(
    ((progressData.current as number) / (progressData.total as number)) * 100,
  );

  // Hiển thị tiến trình
  showProgressBar(
    downloadButton,
    percentage,
    `Downloading ${progressData.current}/${progressData.total} files (${percentage}%)`,
  );

  // Khi hoàn thành
  if ((progressData.current as number) >= (progressData.total as number)) {
    setTimeout(() => {
      showProgressBar(downloadButton, 100, "Download Complete!");

      // Đặt lại nút sau 3 giây
      setTimeout(() => {
        downloadButton.innerHTML = `
                    <span class="eph_toolkit_icon"></span>
                    <span class="eph_toolkit_text">Download All</span>
                `;
        state.isProcessingProfile = false;
      }, 3000);
    }, 500);
  }
}
// Intercept the message system to apply filters

/**
 * Handle click on profile download button
 */
export function handleProfileDownload(this: HTMLElement): void {
  // Make sure we're not already processing a download
  if (state.isProcessingProfile) return;
  state.isProcessingProfile = true;

  // Get username from URL
  const username = getProfileUsername();
  if (!username) {
    showProfileDownloadError(this, "Couldn't identify username");
    state.isProcessingProfile = false;
    return;
  }

  // Show loading indicator while fetching post count
  const buttonElement = this;
  buttonElement.innerHTML = `
        <span class="eph_toolkit_icon" style="animation: spin 1s linear infinite;"></span>
        <span class="eph_toolkit_text">Loading...</span>
    `;

  // Get post count using the direct API call
  getUserPostCount(username)
    .then((postCount) => {
      // Reset the download button appearance
      buttonElement.innerHTML = `
                <span class="eph_toolkit_icon"></span>
                <span class="eph_toolkit_text">Download All</span>
            `;

      // Reset processing flag until user confirms download
      state.isProcessingProfile = false;

      // Show the filter popup with the post count
      showFilterPopup(buttonElement, username, postCount);
    })
    .catch((error) => {
      console.error("Failed to get post count:", error);

      // Reset the download button appearance
      buttonElement.innerHTML = `
                <span class="eph_toolkit_icon"></span>
                <span class="eph_toolkit_text">Download All</span>
            `;

      // Reset processing flag
      state.isProcessingProfile = false;

      // Show popup with a default estimated count
      showFilterPopup(buttonElement, username, 50); // Default to 50 posts if we can't get the real count
    });
}

/**
 * Show error message on profile download button
 */
export function showProfileDownloadError(buttonElement: HTMLElement | null | undefined, message: string): void {
  buttonElement!.innerHTML = `
        <span class="eph_toolkit_icon"></span>
        <span class="eph_toolkit_text">Error: ${message}</span>
    `;

  // Reset after 5 seconds
  setTimeout(() => {
    buttonElement!.innerHTML = `
            <span class="eph_toolkit_icon"></span>
            <span class="eph_toolkit_text">Download All</span>
        `;
    state.isProcessingProfile = false;
  }, 5000);
}
export function showProfileDownloadCaution(buttonElement: HTMLElement | null | undefined, message: string): void {
  buttonElement!.innerHTML = `
        <span class="eph_toolkit_icon"></span>
        <span class="eph_toolkit_text">CAUTION: ${message}</span>
    `;

  // Reset after 5 seconds
  setTimeout(() => {
    buttonElement!.innerHTML = `
            <span class="eph_toolkit_icon"></span>
            <span class="eph_toolkit_text">Download All</span>
        `;
    state.isProcessingProfile = false;
  }, 5000);
}
