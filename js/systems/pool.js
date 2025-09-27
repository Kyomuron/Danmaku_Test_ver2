export class Pool {
  constructor(factory, size) {
    this.a = Array.from({ length: size }, factory);
  }

  get() {
    const it = this.a.find(o => !o.active);
    return it ?? null;
  }

  forEach(fn) {
    for (let i = 0; i < this.a.length; i++) {
      fn(this.a[i], i);
    }
  }

  activeCount() {
    return this.a.filter(o => o.active).length;
  }
}