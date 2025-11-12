/**
 * 高亮管理器 - 管理页面搜索关键词高亮和取消高亮功能
 */

class HighlightManager {
  constructor() {
    this.hasHighlight = false;
    this.currentKeywords = [];
    this.highlightClassName = "search-keyword";
    this.init();
  }

  init() {
    // 检查URL参数，确定是否有高亮
    this.checkUrlHighlight();

    // 绑定取消高亮按钮事件
    this.bindClearHighlightEvent();

    // 监听浏览器前进后退
    window.addEventListener("popstate", () => {
      this.checkUrlHighlight();
    });
  }

  // 检查URL中的highlight参数
  checkUrlHighlight() {
    const params = new URL(location.href).searchParams.get("highlight");
    const keywords = params
      ? params.split(" ").filter((k) => k.length > 0)
      : [];

    this.currentKeywords = keywords;
    this.hasHighlight = keywords.length > 0;

    // 更新取消高亮按钮的显示状态
    this.updateClearHighlightButton();
  }

  // 更新取消高亮按钮的显示/隐藏状态
  updateClearHighlightButton() {
    const clearButton = document.getElementById("clear-highlight-button");
    if (clearButton) {
      if (this.hasHighlight) {
        clearButton.style.display = "inline-block";
      } else {
        clearButton.style.display = "none";
      }
    }
  }

  // 绑定取消高亮按钮事件
  bindClearHighlightEvent() {
    const clearButton = document.getElementById("clear-highlight-button");
    if (clearButton) {
      // 使用事件委托来处理动态内容
      document.addEventListener("click", (e) => {
        if (
          e.target.closest("#clear-highlight-button .clear-highlight") ||
          e.target.closest("#clear-highlight-button")
        ) {
          this.clearHighlight();
        }
      });
    }
  }

  // 清除高亮
  clearHighlight() {
    // 移除所有高亮标记
    const highlightedElements = document.querySelectorAll(
      `mark.${this.highlightClassName}`,
    );
    highlightedElements.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        // 将mark元素替换为其文本内容
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        // 合并相邻的文本节点
        parent.normalize();
      }
    });

    // 更新URL，移除highlight参数
    const url = new URL(window.location);
    url.searchParams.delete("highlight");

    // 使用replaceState更新URL，不刷新页面
    window.history.replaceState({}, "", url.toString());

    // 更新状态
    this.hasHighlight = false;
    this.currentKeywords = [];

    // 更新按钮显示状态
    this.updateClearHighlightButton();
  }

  // 高亮文本（用于与现有搜索系统集成）
  highlightText(node, slice, className) {
    const val = node.nodeValue;
    let index = slice.start;
    const children = [];
    for (const { position, length } of slice.hits) {
      const text = document.createTextNode(val.substring(index, position));
      index = position + length;
      const mark = document.createElement("mark");
      mark.className = className;
      mark.appendChild(document.createTextNode(val.substr(position, length)));
      children.push(text, mark);
    }
    node.nodeValue = val.substring(index, slice.end);
    children.forEach((element) => {
      node.parentNode.insertBefore(element, node);
    });
  }

  // 高亮搜索词（集成现有方法）
  highlightSearchWords(body) {
    if (!body) return;

    // 检查URL中的highlight参数
    const params = new URL(location.href).searchParams.get("highlight");
    const keywords = params
      ? params.split(" ").filter((k) => k.length > 0)
      : [];

    if (!keywords.length) return;

    const walk = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
    const allNodes = [];

    while (walk.nextNode()) {
      if (
        !walk.currentNode.parentNode.matches(
          "button, select, textarea, .mermaid, #clear-highlight-button",
        )
      ) {
        allNodes.push(walk.currentNode);
      }
    }

    allNodes.forEach((node) => {
      const [indexOfNode] = this.getIndexByWord(keywords, node.nodeValue);
      if (!indexOfNode.length) return;
      const slice = this.mergeIntoSlice(0, node.nodeValue.length, indexOfNode);
      this.highlightText(node, slice, this.highlightClassName);
    });

    // 更新状态
    this.hasHighlight = true;
    this.currentKeywords = keywords;
    this.updateClearHighlightButton();
  }

  // 从搜索系统复制的方法
  getIndexByWord(words, text, caseSensitive = false) {
    const index = [];
    const included = new Set();

    if (!caseSensitive) {
      text = text.toLowerCase();
    }
    words.forEach((word) => {
      const wordLen = word.length;
      if (wordLen === 0) return;
      let startPosition = 0;
      let position = -1;
      if (!caseSensitive) {
        word = word.toLowerCase();
      }
      while ((position = text.indexOf(word, startPosition)) > -1) {
        index.push({ position, word });
        included.add(word);
        startPosition = position + wordLen;
      }
    });
    index.sort((left, right) => {
      if (left.position !== right.position) {
        return left.position - right.position;
      }
      return right.word.length - left.word.length;
    });
    return [index, included];
  }

  mergeIntoSlice(start, end, index) {
    let item = index[0];
    let { position, word } = item;
    const hits = [];
    const count = new Set();
    while (position + word.length <= end && index.length !== 0) {
      count.add(word);
      hits.push({
        position,
        length: word.length,
      });
      const wordEnd = position + word.length;
      index.shift();
      while (index.length !== 0) {
        item = index[0];
        position = item.position;
        word = item.word;
        if (wordEnd > position) {
          index.shift();
        } else {
          break;
        }
      }
    }
    return {
      hits,
      start,
      end,
      count: count.size,
    };
  }
}

// 创建全局实例
window.highlightManager = new HighlightManager();

// 在页面加载时初始化
window.addEventListener("DOMContentLoaded", () => {
  // 为现有搜索系统集成
  const articleContainer = document.getElementById("article-container");
  if (articleContainer) {
    window.highlightManager.highlightSearchWords(articleContainer);
  }
});

// pjax支持
window.addEventListener("pjax:complete", () => {
  const articleContainer = document.getElementById("article-container");
  if (articleContainer) {
    window.highlightManager.highlightSearchWords(articleContainer);
  }
});

// hexo-blog-encrypt支持
window.addEventListener("hexo-blog-decrypt", () => {
  const articleContainer = document.getElementById("article-container");
  if (articleContainer) {
    window.highlightManager.highlightSearchWords(articleContainer);
  }
});