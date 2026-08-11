// Учебные материалы — сначала список названий уроков, и только при клике на
// конкретный урок открывается его содержимое (PDF + место под видео).
// PDF внутри урока показывается через iframe, но "ленивый": src у iframe не
// задан в разметке напрямую (лежит в data-src), и подставляется скриптом
// только в момент, когда пользователь реально открыл этот конкретный урок.
// Так браузер не начинает скачивать все PDF сразу (они могут весить десятки
// мегабайт) — только тот, который человек на самом деле открыл.
(function () {
  const listView = document.getElementById("materialsListView");
  if (!listView) return;

  const details = document.querySelectorAll(".cabinet__material-detail");
  const cards = document.querySelectorAll("[data-material]");
  const loadedFrames = {};

  function showList() {
    listView.style.display = "";
    details.forEach(function (detail) {
      detail.style.display = "none";
    });
  }

  function showDetail(id) {
    const detail = document.getElementById("materialDetail" + id);
    if (!detail) return;

    listView.style.display = "none";
    details.forEach(function (d) {
      d.style.display = d === detail ? "" : "none";
    });

    if (!loadedFrames[id]) {
      loadedFrames[id] = true;
      const frame = detail.querySelector(".cabinet__material-pdf-frame[data-src]");
      if (frame) frame.src = frame.dataset.src;
    }

    detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  cards.forEach(function (card) {
    const id = card.dataset.material;
    card.addEventListener("click", function () {
      showDetail(id);
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showDetail(id);
      }
    });
  });

  details.forEach(function (detail) {
    const backBtn = detail.querySelector("[data-material-back]");
    if (backBtn) backBtn.addEventListener("click", showList);
  });

  showList();
})();
