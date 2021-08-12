<script lang="ts">
import { defineComponent } from "vue";
import Collapsible from '@/components/Collapsible.vue';
export default defineComponent({
  name: "Contract",
  props: ["id", "blob"],
  components: { Collapsible },
  methods: {
    mouseenter(event: Event) {
      console.log("mouseenter", event)
    },
  }
});
</script>

<template @mouseenter="mouseenter">

  <Collapsible class="Contract">

    <template v-slot:header>
      <label class="icon-blob"></label>
      <h2>Contract info</h2>
    </template>

    <template v-slot:body>

      <section>
        <label class="icon-blob"></label>
        <div>
          <div>
            <strong>{{ blob.name }}</strong>
            <br>
            (12345 bytes raw, 2345 bytes compressed)
          </div>
          <div class="Separator" />
          <code>
            {{ blob.codeHash.slice(0, Math.floor(blob.codeHash.length/2)) }}
            <br>
            {{ blob.codeHash.slice(Math.floor(blob.codeHash.length/2)) }}
          </code>
        </div>
      </section>

      <section>
        <label class="icon-schema"></label>
        <div>
          <div>
            No schema provided.
            <a href="#">Export schema...</a>
          </div>
          <div class="Separator" />
          <button>Import schema...</button>
        </div>
      </section>

      <section>
        <label class="icon-git"></label>
        <div>
          <div>
            <strong>git@github.com:hackbg/sienna.git</strong>
            <br>0c6401afecd518dc5221b7679c2795ee031e3193
          </div>
          <div class="Separator" />
          <div class="Actions">
            <button>Build...</button>
          </div>
        </div>
      </section>

      <section>
        <label class="icon-folder"></label>
        <div>
          <div>
            <strong>contracts/snip20-sienna</strong>
          </div>
          <div class="Separator" />
          <div class="Actions">
            <button>View dependency graph...</button>
            <button>Browse source code...</button>
          </div>
        </div>
      </section>

      <section>
        <label class="icon-checkmark"></label>
        <div>
          <div>
            All <strong>10</strong> unit tests passed,
            achieving <strong>99.9%</strong> coverage.
          </div>
          <div class="Separator" />
          <div class="Actions">
            <button>View report...</button>
            <button>Run unit tests...</button>
          </div>
        </div>
      </section>

      <section>
        <label class="icon-warning"></label>
        <div>
          <div>
            <strong>2</strong> integration tests failed,
            <strong>15</strong> passed.
          </div>
          <div class="Separator" />
          <div class="Actions">
            <button>View report...</button>
            <button>Run integration tests...</button>
          </div>
        </div>
      </section>

      <hr />

      <section>
        <label></label>
        <div>
          <div>
            <h2>Deployments</h2>
            Deployed <strong>3 instances</strong>
            from <strong>3 uploads</strong>
            on <strong>2 networks</strong>.
          </div>
          <div class="Separator" />
          <div class="Actions">
            <button>Find past deployments...</button>
            <button>Upload...</button>
          </div>
        </div>
      </section>

      <Collapsible>
        <template v-slot:header>
          <label class="icon-chain"></label>
          <div>
            <div>
              <code>holodeck-2</code>
            </div>
            <div class="Separator" />
            <div class="Actions">
            </div>
          </div>
        </template>
        <template v-slot:body>

          <section>
            <label class="icon-upload"></label>
            <div>
              <div>
                code id <code>456</code>
              </div>
              <div class="Separator" />
              <div class="Actions">
                <button>View upload transaction...</button>
                <button>Deploy...</button>
              </div>
            </div>
          </section>

          <section>
            <label class="icon-instance"></label>
            <div>
              <div>
                <code>secret1n5xe4hs4xuk6fkatkpqpgpzcqrhwcx29hlkpjd</code>
                <br><br><strong>Friendly Name Here</strong>
                <br>deployed on ...<br>by ...
              </div>
              <div class="Separator" />
              <div class="Actions">
                <button>History...</button>
                <button>Query...</button>
                <button>Transact...</button>
              </div>
            </div>
          </section>

          <section>
            <label class="icon-instance"></label>
            <div>
              <div>
                <code>secret1n5xe4hs4xuk6fkatkpqpgpzcqrhwcx29hlkpjd</code>
                <br><br><strong>Friendly Name Here</strong>
                <br>deployed on ...<br>by ...
              </div>
              <div class="Separator" />
              <div class="Actions">
                <button>History...</button>
                <button>Query...</button>
                <button>Transact...</button>
              </div>
            </div>
          </section>

          <section>
            <label class="icon-upload"></label>
            <div>
              <div>
                code id <code>458</code>
              </div>
              <div class="Separator" />
              <div class="Actions">
                <button>View upload transaction...</button>
                <button>Deploy...</button>
              </div>
            </div>
          </section>

        </template>
      </Collapsible>

      <Collapsible>
        <template v-slot:header>
          <label class="icon-chain"></label>
          <div>
            <div>
              <code>secret-2</code>
            </div>
            <div class="Separator" />
            <div class="Actions">
            </div>
          </div>
        </template>
        <template v-slot:body>

          <section>
            <label class="icon-upload"></label>
            <div>
              <div>
                code id <code>101</code>
              </div>
              <div class="Separator" />
              <div class="Actions">
                <button>View upload transaction...</button>
                <button>Deploy...</button>
              </div>
            </div>
          </section>

          <section>
            <label class="icon-instance"></label>
            <div>
              <div>
                <code>secret1n5xe4hs4xuk6fkatkpqpgpzcqrhwcx29hlkpjd</code>
                <br><br><strong>Friendly Name Here</strong>
                <br>deployed on ...<br>by ...
              </div>
              <div class="Separator" />
              <div class="Actions">
                <button>History...</button>
                <button>Query...</button>
                <button>Transact...</button>
              </div>
            </div>
          </section>

        </template>
      </Collapsible>

    </template>

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
  </Collapsible>
</template>
