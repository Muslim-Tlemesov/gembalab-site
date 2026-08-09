// Учебные материалы — предпросмотр PDF внутри страницы (iframe), но
// "ленивый": src у iframe не задан в разметке напрямую (лежит в data-src),
// и подставляется скриптом только в момент, когда пользователь реально
// открывает раздел "Учебные материалы" в личном кабинете. Так браузер не
// начинает скачивать файл (он может весить десятки мегабайт) сразу при
// заходе на главную страницу — только когда он действительно нужен.
(function () {
  const link = document.querySelector('.cabinet__menu-link[data-panel="materials"]');
  if (!link) return;

  const frames = document.querySelectorAll(".cabinet__material-pdf-frame[data-src]");
  if (!frames.length) return;

  let loaded = false;
  link.addEventListener("click", function () {
    if (loaded) return;
    loaded = true;
    frames.forEach(function (frame) {
      frame.src = frame.dataset.src;
    });
  });
})();
