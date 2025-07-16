<script setup>
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <header>
    <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="125" height="125" />

    <div class="wrapper">
      <HelloWorld msg="You did it!" />

      <nav class="tab-nav">
        <RouterLink to="/serial">Serial</RouterLink>
        <RouterLink to="/camera">Camera</RouterLink>
        <RouterLink to="/microphone">Microphone</RouterLink>
        <RouterLink to="/bluetooth">Bluetooth</RouterLink>
        <RouterLink to="/st-link">ST-Link</RouterLink>
        <RouterLink to="/dap-link">DAP-Link</RouterLink>
        <RouterLink to="/usb-dfu">USB-DFU</RouterLink>
        <RouterLink to="/hid">HID</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

.tab-nav {
  display: flex;
  justify-content: center;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}
.tab-nav a {
  padding: 1rem 2rem;
  text-decoration: none;
  color: #333;
  border-bottom: 2px solid transparent;
  transition: border-color 0.2s;
}
.tab-nav a.router-link-exact-active {
  border-bottom: 2px solid #42b983;
  color: #42b983;
  background: #fff;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
