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

  const setStatus = (message, type = "") => {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`.trim();
  };

  const parseRatio = (ratio) => {
    const [widthStr, heightStr] = ratio.split("x");
    const width = Number(widthStr);
    const height = Number(heightStr);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 64 || height < 64) {
      return { width: 1024, height: 1024 };
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
      params.set("seed", String(Math.floor(Math.random() * 1000000)));
    }

    return `${API_BASE}${encodedPrompt}?${params.toString()}`;
  };

  const renderSkeletons = (count = 3) => {
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

  const renderImages = (urls, prompt) => {
    previewGrid.innerHTML = "";
    urls.forEach((url, index) => {
      const card = document.createElement("article");
      card.className = "image-card";
      const img = document.createElement("img");
      img.src = url;
      img.alt = `${prompt} - variation ${index + 1}`;
      img.loading = "lazy";
      img.decoding = "async";
      card.appendChild(img);
      previewGrid.appendChild(card);
    });
  };

  const preloadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => reject(new Error("Unable to load generated image."));
      img.src = src;
    });

  const generate = async () => {
    const prompt = promptInput.value.trim();
    if (prompt.length < 3) {
      setStatus("Please enter at least 3 characters in the prompt.", "error");
      return;
    }

    setStatus("Generating images...", "");
    generateBtn.disabled = true;
    renderSkeletons(3);

    try {
      const ratio = ratioInput.value;
      const numericSeed = seedInput && seedInput.value ? Number(seedInput.value) : undefined;
      const baseSeed = Number.isFinite(numericSeed) ? numericSeed : Math.floor(Math.random() * 999999);
      const urls = [0, 1, 2].map((offset) => createImageURL(prompt, ratio, baseSeed + offset));

      await Promise.all(urls.map((u) => preloadImage(u)));
      renderImages(urls, prompt);
      setStatus("Done! Your AI images are ready.", "ok");
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
