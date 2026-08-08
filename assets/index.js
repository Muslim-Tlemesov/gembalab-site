// Личный кабинет на главной странице — переключение пунктов меню
// без перехода на другую страницу: клик по пункту показывает
// связанную с ним панель справа и скрывает остальные.

const cabinetLinks = document.querySelectorAll(".cabinet__menu-link");
const cabinetPanels = document.querySelectorAll(".cabinet__panel");

cabinetLinks.forEach((link) => {
  link.addEventListener("click", function (event) {
    event.preventDefault();

    const targetId = "panel-" + link.dataset.panel;

    cabinetLinks.forEach((l) => l.classList.remove("cabinet__menu-link--active"));
    link.classList.add("cabinet__menu-link--active");

    cabinetPanels.forEach((panel) => {
      panel.classList.toggle("cabinet__panel--active", panel.id === targetId);
    });
  });
});
