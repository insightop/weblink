/**
 * 工具函数模块
 * 包含资源加载检测、按钮初始化等通用功能
 */

// 资源加载状态检测
export function checkResourceLoading() {
  const resources = [
    {
      name: "Bootstrap CSS",
      url: "https://cdn.bootcdn.net/ajax/libs/bootstrap/5.3.2/css/bootstrap.min.css",
    },
    {
      name: "Bootstrap Icons",
      url: "https://cdn.bootcdn.net/ajax/libs/bootstrap-icons/1.11.1/font/bootstrap-icons.min.css",
    },
    {
      name: "Animate.css",
      url: "https://cdn.bootcdn.net/ajax/libs/animate.css/4.1.1/animate.min.css",
    },
    {
      name: "DataTables CSS",
      url: "https://cdn.bootcdn.net/ajax/libs/datatables/1.13.7/css/dataTables.bootstrap5.min.css",
    },
    {
      name: "jQuery",
      url: "https://cdn.bootcdn.net/ajax/libs/jquery/3.7.0/jquery.min.js",
    },
    {
      name: "DataTables JS",
      url: "https://cdn.bootcdn.net/ajax/libs/datatables/1.13.7/js/jquery.dataTables.min.js",
    },
    {
      name: "Bootstrap JS",
      url: "https://cdn.bootcdn.net/ajax/libs/bootstrap/5.3.2/js/bootstrap.bundle.min.js",
    },
  ];

  console.log("🔍 检查资源加载状态...");
  resources.forEach((resource) => {
    const link = document.querySelector(
      `link[href*="${resource.name
        .toLowerCase()
        .replace(" ", "")}"], script[src*="${resource.name
        .toLowerCase()
        .replace(" ", "")}"]`
    );
    if (link) {
      console.log(`✅ ${resource.name}: 已加载`);
    } else {
      console.warn(`⚠️ ${resource.name}: 加载失败`);
    }
  });
}

// 初始化下载按钮
export function initDownloadButton() {
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.disabled = false;
    downloadBtn.onclick = function () {
      window.location.href = "download/";
    };
  }
}

// 格式化时间（秒转换为时分秒）
export function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}时${minutes}分${remainingSeconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${remainingSeconds}秒`;
  } else {
    return `${remainingSeconds}秒`;
  }
}

// 格式化距离（米转换为公里）
export function formatDistance(meters) {
  // 如果是字符串 "nan" 或 "-nan"，直接返回
  if (
    meters === "nan" ||
    meters === "-nan" ||
    meters === "NaN" ||
    meters === "-NaN"
  ) {
    return meters;
  }
  const num = Number(meters);
  if (isNaN(num) || !isFinite(num)) {
    // 处理数字型 NaN
    return "nan";
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}公里`;
  }
  return `${num}米`;
}

// 检查是否是完整的JSON数据
export function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

// 防抖函数
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
export function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// 生成唯一ID
export function generateUID() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 深拷贝对象
export function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map((item) => deepClone(item));
  if (typeof obj === "object") {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

// 本地存储工具
export const storage = {
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("存储失败:", e);
    }
  },

  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn("读取存储失败:", e);
      return defaultValue;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("删除存储失败:", e);
    }
  },

  clear() {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("清空存储失败:", e);
    }
  },
};

// 日志工具
export const logger = {
  info(message, ...args) {
    console.log(`[INFO] ${message}`, ...args);
  },

  warn(message, ...args) {
    console.warn(`[WARN] ${message}`, ...args);
  },

  error(message, ...args) {
    console.error(`[ERROR] ${message}`, ...args);
  },

  debug(message, ...args) {
    console.debug(`[DEBUG] ${message}`, ...args);
  },
};
