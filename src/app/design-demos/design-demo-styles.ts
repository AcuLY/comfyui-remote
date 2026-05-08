const styles = new Proxy({}, {
  get: (_target, key) => typeof key === "string" ? key : "",
}) as Record<string, string>;

export default styles;
