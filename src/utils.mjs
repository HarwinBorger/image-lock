export function difference(setA, setB) {
  let _difference = setA;
  for (let elem of setB) {
    delete _difference[elem];
  }
  return _difference
}
