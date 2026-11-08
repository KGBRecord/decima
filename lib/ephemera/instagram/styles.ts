export function injectStyles(): void {
const filterPopupStyle = document.createElement("style");
filterPopupStyle.textContent = `
.eph_toolkit_popup {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    color: #262626;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    padding: 20px;
    z-index: 9999;
    width: 350px;
    max-width: 90%;
    max-height: 85vh; /* Giới hạn chiều cao tối đa là 85% chiều cao viewport */
    overflow-y: auto; /* Thêm thanh cuộn khi nội dung vượt quá */
    overscroll-behavior: contain; /* Ngăn cuộn lan truyền ra ngoài */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Cải thiện kiểu thanh cuộn cho Chrome */
.eph_toolkit_popup::-webkit-scrollbar {
    width: 8px;
}

.eph_toolkit_popup::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}

.eph_toolkit_popup::-webkit-scrollbar-thumb {
    background: #c7c7c7;
    border-radius: 4px;
}

.eph_toolkit_popup::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
}

/* Cố định header popup khi cuộn */
.eph_toolkit_popup_header {
    position: sticky;
    top: -20px; /* Bù trừ với padding của popup */
    background-color: white;
    margin: -20px -20px 15px -20px;
    padding: 20px 20px 10px 20px;
    border-bottom: 1px solid #efefef;
    z-index: 1;
}

/* Cố định nút dưới chân khi cuộn */
.eph_toolkit_popup_buttons {
    position: sticky;
    bottom: -20px; /* Bù trừ với padding của popup */
    background-color: white;
    margin: 20px -20px -20px -20px;
    padding: 10px 20px 20px 20px;
    border-top: 1px solid #efefef;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    z-index: 1;
}
`;

document.head.appendChild(filterPopupStyle);
const styleElement = document.createElement("style");
styleElement.textContent = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}



.eph_toolkit_overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.75);
    z-index: 9998;
}

.eph_toolkit_popup {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    color: #262626;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    padding: 20px;
    z-index: 9999;
    width: 350px;
    max-width: 90%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Force specific colors for text elements to ensure visibility in any mode */
.eph_toolkit_popup_title,
.eph_toolkit_filter_label,most_likes_checkbox ,most_comments_checkbox,
.eph_toolkit_button {
    color: #262626 !important;
}

.eph_toolkit_popup input,
.eph_toolkit_popup button {
    color: #262626 !important;
    background-color: white !important;
}

.eph_toolkit_popup input::placeholder {
    color: #8e8e8e !important;
}

/* Dark mode compatible buttons */
.eph_toolkit_button_cancel {
    background-color: #efefef !important;
    color: #262626 !important;
    border: none !important;
}

.eph_toolkit_button_apply {
    background-color: #0095f6 !important;
    color: white !important;
    border: none !important;
}

.eph_toolkit_popup_close {
    color: #8e8e8e !important;
    cursor: pointer;
    font-size: 20px;
}

.eph_toolkit_popup input::-webkit-outer-spin-button,
.eph_toolkit_popup input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

.eph_toolkit_popup input[type=number] {
    -moz-appearance: textfield;
}

.eph_toolkit_profile_download_btn {
    min-height: 40px;
    position: relative;
    background-color: #0095f6 !important;
    color: white !important;
}

.eph_toolkit_progress_container {
    width: 100%;
    height: 4px;
    background-color: #efefef;
    border-radius: 2px;
    margin-top: 5px;
    overflow: hidden;
}

.eph_toolkit_progress_bar {
    height: 100%;
    background-color: #0095f6;
    transition: width 0.3s ease;
}

.eph_toolkit_status {
    font-size: 14px;
    text-align: center;
    margin-bottom: 5px;
    color: #262626 !important;
}

.eph_toolkit_filter_group {
    margin-bottom: 15px;
    border-radius: 4px;
    padding: 10px;
}

/* Specific background colors for different filter groups */
.eph_toolkit_filter_group.posts-range {
    background-color: #edf9ff !important;
}

.eph_toolkit_filter_group.top-posts {
    background-color: #fff0f5 !important;
}

/* Force standard colors for different sections */
.eph_toolkit_posts_info {
    background-color: #f9f9f9 !important;
    color: #262626 !important;
}
`;

document.head.appendChild(styleElement);
}
