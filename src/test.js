const date = "2022-04-24T07:46:21Z";

let newDate = new Date();
newDate.setTime(new Date(date).getTime());
let dateString = newDate.toDateString();
let timeString = newDate.toLocaleTimeString();
console.log(dateString + " " + timeString);
