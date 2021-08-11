<template @mouseenter="mouseenter">
  <div class="WasmBlob Box">

    <section>
      <label class="Blob icon-blob"></label>
      <div>
        <strong>{{ blob.name }}</strong>
        <div class="Separator" />
        <div>{{ blob.codeHash }}</div>
      </div>
    </section>

    <section>
      <label class="Schema icon-schema"></label>
      <div>
        <div class="Info">No schema loaded.</div>
        <div class="Separator" />
        <button>Provide schema...</button>
      </div>
    </section>

    <section>
      <label class="Upload icon-upload"></label>
      <div>
        <div class="Info">Not uploaded to any chains.</div>
        <div class="Separator" />
        <button>Look for matching code hashes...</button>
        <button>Upload to chain...</button>
      </div>
    </section>

    <section>
      <label class="Instance icon-instance"></label>
      <div>
        <div class="Info">No instances registered.</div>
        <div class="Separator" />
        <button>Bookmark instance...</button>
        <button>Deploy instance...</button>
      </div>
    </section>

    <!--<header class="Header">
      <div class="Title">
      </div>
      <button class="Close icon-close" />
    </header>

    <section class="Content">
      <div class="InstancePicker">
        <img class="InstSearchIcon icon-filter" />
        <div class="InstSearch"><input type="text" placeholder="filter instances" /></div>
        <div class="InstList">instance list</div>
      </div>
      <div class="MethodPicker">
        <img class="InstIcon icon-instance" />
        <div class="InstTitle">
          <div><strong>inst label</strong><br>inst addr</div>
        </div>
        <div class="MethodList">instance method list</div>
      </div>
      <div class="Invocation">
        <div class="MethodIcon">q/tx</div>
        <div class="Method">method name</div>
        <div class="MethodArgs">method args</div>
        <button class="MethodRun icon-run" />
        <div class="MethodResult">method result</div>
      </div>
    </section>

    <div class="StatusBar"><strong>Helpful status bar&nbsp;</strong> instead of distracting tooltips</div>-->
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
export default defineComponent({
  name: "WasmBlob",
  props: ["id", "blob"],
  methods: {
    mouseenter(event: Event) {
      console.log("mouseenter", event)
    },
  }
});
</script>

<style scoped lang="scss">
* {
  position: relative;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: none;
}

.WasmBlob {
  background: #111;
  color: white;
  max-width: 100%;
  padding: 0;
  text-align: left;
  border: 2px solid black;

  display: flex;
  flex-flow: column nowrap;
  align-items: stretch;

  input {
    align-self: stretch;
    border-radius: 3em;
    margin: 0.5em 0;
  }

  button {
    background: rgba(255,255,255,0.1);
    color: white;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-left: 1em;
    padding: 0.5em 1em;
    transition: background 0.16s ease;
    cursor: pointer;
    &:hover {
      background: rgba(255,255,255,0.2);
    }
  }

  label {
    align-self: stretch;
    cursor: pointer;
    font-weight: bold;
    //background: black;
    color: white;
    border: none;
    font-size: 1.5em;
    display: grid;
    justify-content: center;
    align-items: center;
    opacity: 0.8;
    &:hover {
      opacity: 1.0;
    }
  }

  .Separator {
    flex-grow: 1;
  }

  & > section {
    display: grid;
    grid-template-columns: 3rem 1fr;
    grid-template-areas: "Button1 Content";
    color: white;
    min-height: 3rem;
    align-items: center;
    :nth-child(1) { grid-area: Button1; }
    :nth-child(2) {
      grid-area: Content;
      padding: 0 1em 0 0.5em;
      display: flex;
      flex-flow: row nowrap;
      align-items: flex-start;
    }
    :nth-child(3) { grid-area: Button2; }
    .Info { padding-top: 0.25rem }
  }

  & > .Header {
    grid-area: Header;
    display: grid;
    grid-template-columns: 3em 1fr 3em;
    grid-template-areas: "CodeId Title Close";
    .CodeId {
      grid-area: CodeId;
      height: 3rem;
      align-self: center;
      justify-self: center;
      display: flex;
      flex-flow: row nowrap;
      align-items: center;
    }
    .Title {
      grid-area: Title;
      color: white;
      text-shadow: 1px 1px 0 black;
      align-self: stretch;
      display: flex;
      align-items: center;
      flex-flow: row nowrap;
      margin: 0.25rem;
    }
    .Close {
      grid-area: Close;
      font-size: 1.5em;
    }
  }

  & > .Content {
    grid-area: Content;
    align-self: stretch;

    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-areas: "InstancePicker MethodPicker Invocation";
    .InstancePicker {
      grid-area: InstancePicker;
      align-self: stretch;
      display: grid;
      grid-template-rows: 3em 1fr;
      grid-template-columns: 3em 1fr;
      grid-template-areas:
        "Icon Title"
        "Items Items";
      .InstSearchIcon {
        grid-area: Icon;
        text-align: center;
        font-size: 1.5em;
        align-self: stretch;
      }
      .InstSearch {
        grid-area: Title;
        align-self: stretch;
      }
      .InstList {
        grid-area: Items;
        align-self: stretch;
      }
    }
    .MethodPicker {
      grid-area: MethodPicker;
      align-self: stretch;
      display: grid;
      grid-template-rows: 3em 1fr;
      grid-template-columns: 3em 1fr;
      grid-template-areas:
        "Icon Title"
        "Items Items";
      .InstIcon {
        grid-area: Icon;
        text-align: center;
        font-size: 1.5em;
        align-self: stretch;
      }
      .InstTitle {
        color: white;
        text-shadow: 1px 1px 0 black;
        grid-area: Title;
        align-self: stretch;
        display: flex;
        align-items: center;
        flex-flow: row nowrap;
      }
      .MethodList {
        grid-area: Items;
        align-self: stretch;
      }
    }
    .Invocation {
      grid-area: Invocation;
      align-self: stretch;
      display: grid;
      grid-template-rows: 3em 1fr 0 1fr;
      grid-template-columns: 3em 1fr;
      grid-template-areas:
        "Icon Title"
        "Args Args"
        "Run Run "
        "Result Result";
      .MethodIcon {
        grid-area: Icon;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-size: 0.9em;
        border: 1px solid #888;
        align-self: stretch;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-flow: row nowrap;
      }
      .MethodName {
        grid-area: Title;
      }
      .MethodArgs {
        grid-area: Args;
        align-self: stretch;
      }
      .MethodRun {
        grid-area: Run;
        width: 3rem;
        height: 3rem;
        border-radius: 3rem;
        text-align: center;
        justify-self: center;
        margin-top: -1.5rem;
        border: 1px solid #0f0;
      }
      .MethodResult {
        grid-area: Result;
        align-self: stretch;
      }
    }
  }

  & > .StatusBar {
    grid-area: StatusBar;
    color: white;
    align-self: stretch;
    display: flex;
    align-items: center;
    flex-flow: row nowrap;
    padding: 0 1em;
  }

  .Box.Header {
    min-height: 3em;
    grid-template-columns: 10% 80% 10%;
    grid-template-rows: 50% 50%;
  }
  .Box.Insts {
    text-align: left;
  }
  .CodeId {
    grid-column-start: 1;
    grid-column-end: 2;
    grid-row-start: 1;
    grid-row-end: 3;
    font-weight: bold;
  }
  .CodeName {
    grid-column-start: 2;
    grid-column-end: 3;
    grid-row-start: 1;
    grid-row-end: 2;
    margin-bottom: 0.5em;
  }
  .CodeHash {
    grid-column-start: 2;
    grid-column-end: 3;
    grid-row-start: 2;
    grid-row-end: 3;
    font-family: monospace;
    font-size: 0.9;
  }
  .Close {
    grid-column-start: 3;
    grid-column-end: 4;
    grid-row-start: 1;
    grid-row-end: 3;
    font-weight: bold;
  }
}
</style>
