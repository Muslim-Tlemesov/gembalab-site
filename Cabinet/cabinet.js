// Личный кабинет на главной странице.
// Ничего не открыто по умолчанию. Клик по пункту меню плавно показывает
// соответствующую панель справа (как подменю), скрывая предыдущую; повторный
// клик по уже открытому пункту плавно закрывает панель.

const cabinetLinks = document.querySelectorAll(".cabinet__menu-link");
const cabinetPanels = document.querySelectorAll(".cabinet__panel");

function hidePanel(panel) {
  panel.classList.remove("cabinet__panel--active");
  panel.addEventListener(
    "transitionend",
    function hide(event) {
      if (event.propertyName !== "opacity") return;
      panel.classList.remove("cabinet__panel--visible");
      panel.removeEventListener("transitionend", hide);
    }
  );
}

function showPanel(panel) {
  panel.classList.add("cabinet__panel--visible");
  // двойной requestAnimationFrame — чтобы браузер успел отрисовать
  // display:block до включения transition, иначе анимация не сыграет
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      panel.classList.add("cabinet__panel--active");
    });
  });
}

cabinetLinks.forEach((link) => {
  link.addEventListener("click", function (event) {
    event.preventDefault();

    const targetPanel = document.getElementById("panel-" + link.dataset.panel);
    if (!targetPanel) return;

    const wasActive = link.classList.contains("cabinet__menu-link--active");

    cabinetLinks.forEach((l) => l.classList.remove("cabinet__menu-link--active"));
    cabinetPanels.forEach((panel) => {
      if (panel !== targetPanel && panel.classList.contains("cabinet__panel--active")) {
        hidePanel(panel);
      }
    });

    if (wasActive) {
      hidePanel(targetPanel);
      return;
    }

    link.classList.add("cabinet__menu-link--active");
    showPanel(targetPanel);
  });
});
