const fontSize1 = document.getElementById("fontSize");
for (let i = 1; i <= 200; i++) {
  const option = document.createElement("option");
  option.value = i;
  option.textContent = i;
  fontSize1.appendChild(option);
}
