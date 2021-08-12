<template>
  <router-view />
</template>

<style lang="scss">
html {
  height: 100%;
}
body {
  min-height: 100%;
  position: relative;
  margin: 0;
  background: #423;
  display: flex;
  flex-flow: column nowrap;
  justify-content: flex-start;
  align-items: center;
}

#app {
  position: absolute;
  index: 0;
  z-index: 1;
  display: flex;
  flex-flow: column nowrap;
  align-items: flex-start;

  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#nav {
  padding: 30px;

  a {
    font-weight: bold;
    color: #2c3e50;

    &.router-link-exact-active {
      color: #42b983;
    }
  }
}

@import "./components/box.scss";
</style>
