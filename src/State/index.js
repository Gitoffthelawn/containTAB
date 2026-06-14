function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  )).join(',')}}`;
}

function isEqual(a, b) {
  if (Object.is(a, b)) return true;
  return stableStringify(a) === stableStringify(b);
}

class State {

  constructor() {
    this.state = {};
    this.listeners = [];
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    if (isEqual(this.state[key], value)) {
      return this.state;
    }
    this.state[key] = value;
    this.listeners.forEach((fn) => fn.call(null, this.state, key));
    return this.state;
  }

  setState(newState) {
    return this.state = newState;
  }

  addListener(fn) {
    this.listeners.push(fn);
  }

}

export default new State();
