import swal from 'sweetalert2';
import idb from 'idb';

let indexDB;
const convertBtn = document.getElementById('js_convertBtn');
let inputAmount = document.getElementById('js_inputAmount');
let resultingAmount = document.getElementById('js_resultingAmount');
const srcSelect = document.getElementsByTagName('select')[0];
const destSelect = document.getElementsByTagName('select')[1];


window.addEventListener('load', () => {
  const selectElements = document.getElementsByTagName('select');
  fetch('https://free.currencyconverterapi.com/api/v5/currencies')
    .then(currennciesResp => currennciesResp.json())
    .then(currencies => {
      let currencyName;
      let currencyCode;
      let option;
      for (const currency in currencies.results) {
        currencyName = currencies.results[currency].currencyName;
        currencyCode = currencies.results[currency].id;
        option = document.createElement('option');
        option.innerText = `${currencyCode} | ${currencyName}`;
        option.id = currencyCode;
        selectElements[0].appendChild(option.cloneNode(true));
        selectElements[1].appendChild(option);
      }
    });
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js')
      .then(reg => console.log('Registration successful'))
      .catch(() => console.log('Registration failed'));
  }
  // open an idb
  indexDB = idb.open('currenciesDB', 1, upgradeDB => {
    upgradeDB.createObjectStore('rates', { keyPath: 'id' });
  });
});


convertBtn.addEventListener('click', () => {
  const src_selected_opt = srcSelect.options[srcSelect.selectedIndex];
  const dest_selected_opt = destSelect.options[destSelect.selectedIndex];
  const src_currency = src_selected_opt.id;
  const dest_currency = dest_selected_opt.id;

  const fetchRate = function(isRateFound) {
    return fetch(
      `https://free.currencyconverterapi.com/api/v5/convert?q=${src_currency}_${dest_currency}&compact=ultra`
    )
      .then(rateResp => {
        return rateResp.json();
      })
      .then(rate => {
        const rate_value = rate[`${src_currency}_${dest_currency}`];
        indexDB.then(db => {
          const tx = db.transaction('rates', 'readwrite');
          const ratesStore = tx.objectStore('rates');
          ratesStore.put({
            rate: rate_value,
            id: `${src_currency}_${dest_currency}`
          });
          return tx.complete;
        });
        return rate_value;
      })
      .catch(() => {
        if (!isRateFound)
          swal({
            type: 'error',
            title: 'Error',
            text: 'App is Offline'
          });
      });
  };

  if (inputAmount.value === '') {
    swal({
      type: 'error',
      title: 'Error',
      text: 'This field cannot be empty'
    });
    return;
  }
  indexDB.then(db => {
    const ratesStore = db.transaction('rates').objectStore('rates');
    let storedRate;
    ratesStore
      .openCursor()
      .then(function cursorIterate(cursor) {
        if (!cursor) return;
        storedRate = cursor.value;
        return (
          cursor.value.id === `${src_currency}_${dest_currency}` ||
          cursor.continue().then(cursorIterate)
        );
      })
      .then(isRateFound => {

        if (isRateFound && storedRate)
          resultingAmount.textContent = `${dest_currency} ${(
            storedRate.rate * inputAmount.value
          ).toFixed(2)}`;

        else
          return fetchRate(isRateFound).then(
            fetchedRate =>
              (resultingAmount.textContent = `${dest_currency} ${(
                fetchedRate * inputAmount.value
              ).toFixed(2)}`)
          );
      });
  });

  inputAmount.focus();
});
