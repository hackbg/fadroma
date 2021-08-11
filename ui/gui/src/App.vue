<template>
  <router-view />
</template>

<style lang="scss">
body {
  position: relative;
  margin: 0;
  background: #312;
}

#app {
  position: absolute;
  index: 0;
  width: 100vw;
  height: 100vh;
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
</style>
