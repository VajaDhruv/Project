(() => {
  const form = document.getElementById("generator-form");
  const promptInput = document.getElementById("prompt");
  const ratioInput = document.getElementById("ratio");
  const seedInput = document.getElementById("seed");
  const generateBtn = document.getElementById("generate-btn");
  const statusEl = document.getElementById("status");
  const previewGrid = document.getElementById("preview-grid");
  const tiltCard = document.getElementById("tilt-card");

  if (!form || !promptInput || !ratioInput || !generateBtn || !statusEl || !previewGrid || !tiltCard) {
    return;
  }

  const API_BASE = "https://image.pollinations.ai/prompt/";
  const MIN_DIMENSION = 64;
  const DEFAULT_DIMENSION = 1024;
  const MAX_SEED_VALUE = 1000000;
  const IMAGE_COUNT = 3;
  const REQUEST_TIMEOUT_MS = 25000;
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 700;

  const setStatus = (message, type = "") => {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`.trim();
  };

  const parseRatio = (ratio) => {
    const [widthStr, heightStr] = ratio.split("x");
    const width = Number(widthStr);
    const height = Number(heightStr);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width < MIN_DIMENSION || height < MIN_DIMENSION) {
      return { width: DEFAULT_DIMENSION, height: DEFAULT_DIMENSION };
    }

    return { width, height };
  };

  const createImageURL = (prompt, ratio, seed) => {
    const encodedPrompt = encodeURIComponent(prompt.trim());
    const { width, height } = parseRatio(ratio);
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      nologo: "true",
      model: "flux",
    });

    if (seed) {
      params.set("seed", String(seed));
    } else {
      params.set("seed", String(Math.floor(Math.random() * MAX_SEED_VALUE)));
    }

    return `${API_BASE}${encodedPrompt}?${params.toString()}`;
  };

  const renderSkeletons = (count = IMAGE_COUNT) => {
    previewGrid.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const card = document.createElement("article");
      card.className = "image-card";

      const sk = document.createElement("div");
      sk.className = "skeleton";
      card.appendChild(sk);
      previewGrid.appendChild(card);
    }
  };

  const createImageElement = (url, prompt, index) => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = `${prompt} - variation ${index + 1}`;
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  };

  const createFailedCardContent = (url, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "failed-card";

    const label = document.createElement("p");
    label.textContent = `Variation ${index + 1} failed`;
    wrapper.appendChild(label);

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "retry-btn";
    retryBtn.dataset.url = url;
    retryBtn.dataset.index = String(index);
    retryBtn.textContent = "Retry";
    wrapper.appendChild(retryBtn);

    return wrapper;
  };

  const renderResults = (results, prompt) => {
    previewGrid.innerHTML = "";
    results.forEach((result, index) => {
      const card = document.createElement("article");
      card.className = "image-card";
      card.dataset.index = String(index);

      if (result.ok) {
        card.appendChild(createImageElement(result.url, prompt, index));
      } else {
        card.appendChild(createFailedCardContent(result.url, index));
      }

      previewGrid.appendChild(card);
    });
  };

  const wait = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  const preloadImage = (src, timeoutMs = REQUEST_TIMEOUT_MS) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        img.src = "";
        reject(new Error("Image request timed out."));
      }, timeoutMs);

      img.onload = () => {
        clearTimeout(timeout);
        resolve(src);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Unable to load generated image from API. Please check your connection and try again."));
      };
      img.src = src;
    });

  const loadWithRetry = async (src, retries = MAX_RETRIES) => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await preloadImage(src);
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        await wait(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  };

  const getFailedVariationCount = () => previewGrid.querySelectorAll(".retry-btn").length;

  const updateRetryStatus = () => {
    const failedCount = getFailedVariationCount();
    if (failedCount === 0) {
      setStatus("Done! Your AI images are ready.", "ok");
    } else {
      setStatus(`${IMAGE_COUNT - failedCount}/${IMAGE_COUNT} generated. Retry failed variations.`, "warning");
    }
  };

  const generate = async () => {
    const prompt = promptInput.value.trim();
    if (prompt.length < 3) {
      setStatus("Please enter at least 3 characters in the prompt.", "error");
      return;
    }

    setStatus("Generating images...", "");
    generateBtn.disabled = true;
    renderSkeletons(IMAGE_COUNT);

    try {
      const ratio = ratioInput.value;
      const numericSeed = seedInput && seedInput.value ? Number(seedInput.value) : undefined;
      const baseSeed = Number.isFinite(numericSeed) ? numericSeed : Math.floor(Math.random() * MAX_SEED_VALUE);
      const urls = Array.from({ length: IMAGE_COUNT }, (_, offset) => createImageURL(prompt, ratio, baseSeed + offset));

      const settled = await Promise.allSettled(urls.map((url) => loadWithRetry(url)));
      const results = settled.map((entry, index) =>
        entry.status === "fulfilled" ? { ok: true, url: entry.value } : { ok: false, url: urls[index] }
      );
      const successCount = results.filter((item) => item.ok).length;

      renderResults(results, prompt);

      if (successCount === IMAGE_COUNT) {
        setStatus("Done! Your AI images are ready.", "ok");
      } else if (successCount > 0) {
        setStatus(`${successCount}/${IMAGE_COUNT} generated. Retry failed variations.`, "warning");
      } else {
        setStatus("All variations failed. Please retry.", "error");
      }
    } catch (error) {
      renderSkeletons(1);
      setStatus("Failed to generate images. Please try again.", "error");
    } finally {
      generateBtn.disabled = false;
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await generate();
  });

  previewGrid.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.classList.contains("retry-btn")) {
      return;
    }

    const url = target.dataset.url;
    const index = Number(target.dataset.index);
    if (!url || !Number.isFinite(index)) {
      return;
    }

    const card = target.closest(".image-card");
    if (!card) {
      return;
    }

    target.disabled = true;
    target.textContent = "Retrying...";
    setStatus(`Retrying variation ${index + 1}...`, "");

    try {
      const loadedUrl = await loadWithRetry(url, MAX_RETRIES);
      card.innerHTML = "";
      card.appendChild(createImageElement(loadedUrl, promptInput.value.trim(), index));
      updateRetryStatus();
    } catch (error) {
      target.disabled = false;
      target.textContent = "Retry";
      setStatus(`Variation ${index + 1} is still failing. Please retry.`, "error");
    }
  });

  tiltCard.addEventListener("mousemove", (event) => {
    const rect = tiltCard.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 8;
    const rotateX = (0.5 - py) * 8;
    tiltCard.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
  });

  tiltCard.addEventListener("mouseleave", () => {
    tiltCard.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
  });
})();
