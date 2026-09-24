// Energy prices entered from the customer's current contract, before tax.
export function contractRate(type, rates, date, hour, hourlyRate) {
  if (type === "hourly") return Number.isFinite(hourlyRate) ? hourlyRate : null;
  if (type === "flat") return validRate(rates.flat);
  if (type !== "period") return null;

  const day = new Date(`${date}T12:00:00`).getDay();
  const period = day === 0 || day === 6 || hour < 8
    ? "valley"
    : (hour >= 10 && hour < 14) || (hour >= 18 && hour < 22)
      ? "peak"
      : "mid";
  return validRate(rates[period]);
}

function validRate(value) {
  if (value === "" || value == null) return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 && rate <= 1 ? rate : null;
}
