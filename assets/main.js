// Общий скрипт сайта GEMBALAB — мобильное меню (бургер), используется на всех страницах

const burger = document.getElementById("burgerBtn");
const nav = document.getElementById("mainNav");

if (burger) {
  burger.addEventListener("click", function () {
    nav.classList.toggle("nav--open");
  });
}
