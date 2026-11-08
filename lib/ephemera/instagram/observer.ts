import { addbutndow } from './buttons';
import { addVideoDownloadButton } from './video';
import { addExploreDownloadButtons, addSingleImageDownloadButtons, callpush, cleanupIgDownloadButtons } from './grid';
import { state } from './state';

// Tạo một throttled handler để giảm tần suất xử lý
export function throttledProcessMediaElements() {
  if (state.isProcessing) return;
  state.isProcessing = true;

  // Hủy timeout hiện tại nếu có
  if (state.processingTimeout) {
    clearTimeout(state.processingTimeout);
  }

  // Thiết lập timeout mới để xử lý các phần tử sau một khoảng thời gian ngắn
  state.processingTimeout = setTimeout(() => {
    // Xử lý các phần tử media đã thu thập
    if (state.mediaElementsToProcess.size > 0) {
      console.log(`Processing ${state.mediaElementsToProcess.size} media elements`);

      // Xử lý các phần tử media
      state.mediaElementsToProcess.forEach((element) => {
        try {
          // Gọi callpush cho từng phần tử
          callpush(element);
        } catch (error) {
          console.error("Error processing media element:", error);
        }
      });

      // Xóa tất cả phần tử đã xử lý
      state.mediaElementsToProcess.clear();

      // Thử thêm buttons cho stories nếu có
      try {
        addbutndow();
      } catch (error) {
        console.error("Error adding story buttons:", error);
      }

      // Gắn nút tải video cho bài viết có video
      try {
        addVideoDownloadButton();
      } catch (error) {
        console.error("Error adding video buttons:", error);
      }

      // Gắn nút tải cho bài Instagram chỉ có 1 ảnh hoặc layout không có role wrapper
      try {
        addSingleImageDownloadButtons();
      } catch (error) {
        console.error("Error adding single image buttons:", error);
      }
      try {
        addExploreDownloadButtons();
      } catch (error) {
        console.error("Error adding explore buttons:", error);
      }
      try {
        cleanupIgDownloadButtons();
      } catch (error) {
        console.error("Error cleaning Instagram buttons:", error);
      }
    }

    // Reset trạng thái xử lý
    state.isProcessing = false;
  }, 200); // Chờ 200ms giữa các lần xử lý
}

// Hàm để kiểm tra nhanh xem một phần tử có phải là media và cần xử lý không
export function shouldProcessMediaElement(element: Element): boolean {
  // Kiểm tra nếu phần tử là hình ảnh hoặc video
  if (element.tagName !== "IMG" && element.tagName !== "VIDEO") {
    return false;
  }

  // Kiểm tra nếu phần tử đã được đánh dấu là đã xử lý
  if (element.hasAttribute("data-ig-processed")) {
    return false;
  }

  // Với hình ảnh, kiểm tra kích thước tối thiểu
  if (element.tagName === "IMG") {
    // Nếu kích thước không đủ lớn, kiểm tra xem có phải là một phần của post không
    if ((element as HTMLImageElement).width < 300 || (element as HTMLImageElement).height < 300) {
      const isInPost = !!element.closest('a[href*="/p/"]');
      if (!isInPost) {
        return false;
      }
    }
  }

  // Đánh dấu phần tử đã được xử lý để tránh xử lý lặp lại
  element.setAttribute("data-ig-processed", "true");
  return true;
}

// Tạo MutationObserver với cấu hình tối ưu
const optimizedObserverConfig: MutationObserverInit = {
  childList: true, // Quan sát thêm/xóa children
  subtree: true, // Quan sát toàn bộ cây con
  attributeFilter: ["src", "srcset", "style", "class"], // Chỉ quan sát các thuộc tính cần thiết
  attributes: true, // Quan sát thay đổi thuộc tính
};

// Hàm callback cho MutationObserver
export function optimizedMutationCallback(mutations: MutationRecord[]): void {
  let hasRelevantChanges = false;

  // Kiểm tra nhanh xem có mutation nào liên quan đến media không
  for (const mutation of mutations) {
    // Nếu là thay đổi thuộc tính
    if (mutation.type === "attributes") {
      const target = mutation.target as Element;
      if (
        (target.tagName === "IMG" || target.tagName === "VIDEO") &&
        !target.hasAttribute("data-ig-processed")
      ) {
        hasRelevantChanges = true;
        if (shouldProcessMediaElement(target)) {
          state.mediaElementsToProcess.add(target);
        }
      }
    }
    // Nếu là thay đổi children
    else if (mutation.type === "childList") {
      // Kiểm tra các node mới thêm vào
      mutation.addedNodes.forEach((addedNode) => {
        const node = addedNode as Element;
        // Nếu node là phần tử HTML
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Nếu node là media
          if (
            (node.tagName === "IMG" || node.tagName === "VIDEO") &&
            !node.hasAttribute("data-ig-processed")
          ) {
            hasRelevantChanges = true;
            if (shouldProcessMediaElement(node)) {
              state.mediaElementsToProcess.add(node);
            }
          }

          // Tìm tất cả media trong node mới
          const mediaElements = node.querySelectorAll<HTMLElement>(
            "img:not([data-ig-processed]), video:not([data-ig-processed])",
          );
          if (mediaElements.length > 0) {
            hasRelevantChanges = true;
            mediaElements.forEach((element: Element) => {
              if (shouldProcessMediaElement(element)) {
                state.mediaElementsToProcess.add(element);
              }
            });
          }
        }
      });
    }
  }

  // Nếu có thay đổi liên quan, bắt đầu xử lý
  if (hasRelevantChanges) {
    throttledProcessMediaElements();
  }
}

// Tạo observer mới với cấu hình tối ưu
const optimizedObserver = new MutationObserver(optimizedMutationCallback);

// Thêm cơ chế tự làm mới cache để tránh rò rỉ bộ nhớ
export function cleanupCache() {
  // Giới hạn kích thước cache để tránh sử dụng quá nhiều bộ nhớ
  const MAX_CACHE_ENTRIES = 100;

  // Làm sạch state.mediaCache
  if (state.mediaCache && Object.keys(state.mediaCache).length > MAX_CACHE_ENTRIES) {
    console.log("Cleaning up media cache");
    // Lấy các khóa để xóa (giữ lại 80% mới nhất)
    const keysToKeep = Object.keys(state.mediaCache).slice(
      -Math.floor(MAX_CACHE_ENTRIES * 0.8),
    );

    // Tạo cache mới với các mục cần giữ lại
    const newCache: typeof state.mediaCache = {};
    keysToKeep.forEach((key) => {
      newCache[key] = state.mediaCache[key];
    });

    // Thay thế cache cũ
    state.mediaCache = newCache;
  }

  // Làm sạch state.postIdCache
  if (state.postIdCache && Object.keys(state.postIdCache).length > MAX_CACHE_ENTRIES) {
    console.log("Cleaning up postId cache");
    // Lấy các khóa để xóa (giữ lại 80% mới nhất)
    const keysToKeep = Object.keys(state.postIdCache).slice(
      -Math.floor(MAX_CACHE_ENTRIES * 0.8),
    );

    // Tạo cache mới với các mục cần giữ lại
    const newCache: typeof state.postIdCache = {};
    keysToKeep.forEach((key) => {
      newCache[key] = state.postIdCache[key];
    });

    // Thay thế cache cũ
    state.postIdCache = newCache;
  }
}

// Thiết lập làm sạch cache định kỳ

// Bắt đầu quan sát DOM và thay thế observer cũ
export function initializeOptimizedObserver() {
  // Tham chiếu đến observer hiện tại từ mã gốc (đã được định nghĩa trước đó)

  // Xử lý các phần tử media đã có trên trang trước khi bắt đầu quan sát
  const existingMedia = document.querySelectorAll<HTMLElement>(
    "img:not([data-ig-processed]), video:not([data-ig-processed])",
  );
  existingMedia.forEach((element) => {
    if (shouldProcessMediaElement(element)) {
      state.mediaElementsToProcess.add(element);
    }
  });

  // Xử lý ngay lập tức các phần tử đã có
  if (state.mediaElementsToProcess.size > 0) {
    throttledProcessMediaElements();
  }

  // Bắt đầu quan sát DOM với observer mới
  optimizedObserver.observe(document.body, optimizedObserverConfig);

  console.log("Optimized mutation observer started");
}

export function startObserver(): void {
  setInterval(cleanupCache, 5 * 60 * 1000); // Mỗi 5 phút
// Đảm bảo rằng chúng ta chỉ khởi tạo observer mới sau khi mã gốc đã chạy
// và biến 'observer' đã được định nghĩa
if (document.readyState === "loading") {
  // Nếu DOM vẫn đang tải, đợi DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    // Đợi thêm một chút để đảm bảo mã gốc đã chạy
    setTimeout(initializeOptimizedObserver, 500);
  });
} else {
  // Nếu DOM đã sẵn sàng, đợi một khoảng thời gian ngắn và khởi tạo
  setTimeout(initializeOptimizedObserver, 500);
}
}
