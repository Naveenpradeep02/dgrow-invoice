// Converts amount numbers to formal Indian Rupee words
// Example: 13334 -> "Rupees Thirteen Thousand Three Hundred and Thirty-Four Only."

function numberToWordsIndian(num) {
  if (num === 0) return 'Zero';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n) {
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + units[n % 10] : '');
    if (n < 1000) {
      const rem = n % 100;
      return units[Math.floor(n / 100)] + ' Hundred' + (rem !== 0 ? ' and ' + convertChunk(rem) : '');
    }
    return '';
  }

  let whole = Math.floor(Math.abs(num));
  let paise = Math.round((Math.abs(num) - whole) * 100);

  if (whole === 0 && paise === 0) return 'Rupees Zero Only.';

  let str = '';

  // Crore (1,00,00,000)
  if (Math.floor(whole / 10000000) > 0) {
    str += convertChunk(Math.floor(whole / 10000000)) + ' Crore ';
    whole %= 10000000;
  }

  // Lakh (1,00,000)
  if (Math.floor(whole / 100000) > 0) {
    str += convertChunk(Math.floor(whole / 100000)) + ' Lakh ';
    whole %= 100000;
  }

  // Thousand (1,000)
  if (Math.floor(whole / 1000) > 0) {
    str += convertChunk(Math.floor(whole / 1000)) + ' Thousand ';
    whole %= 1000;
  }

  // Remaining (1-999)
  if (whole > 0) {
    str += convertChunk(whole);
  }

  str = str.trim();

  let finalWords = 'Rupees ' + str;

  if (paise > 0) {
    finalWords += ' and ' + convertChunk(paise) + ' Paise';
  }

  finalWords += ' Only.';

  return finalWords;
}

module.exports = {
  numberToWordsIndian
};
