<template>
  <router-view />
</template>

<style lang="scss">
body {
  position: relative;
  margin: 0;
  background: #123;
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

.Box {
  background: linear-gradient(-45deg, #ddd, #aaa);
  box-shadow: 0.5em 0.5em 0.5em black;
  display: grid;
  padding: 1em;
  border: 2px solid white;
}

.View {
  box-sizing: border-box;
  min-height: 100vh;
  min-width: 100vw;
  padding: 1em;

  & > .Box {
    margin-bottom: 1em;
  }
}
</style>
