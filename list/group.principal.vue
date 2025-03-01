<script>
import ResourceTable from '@/components/ResourceTable';
import Loading from '@/components/Loading';
import Masthead from '@/components/ResourceList/Masthead';
import { NORMAN, MANAGEMENT } from '@/config/types';
import AsyncButton from '@/components/AsyncButton';
import { applyProducts } from '@/store/type-map';
import { NAME } from '@/config/product/auth';
import { MODE, _EDIT } from '@/config/query-params';
import { mapState } from 'vuex';

export default {
  components: {
    AsyncButton, ResourceTable, Masthead, Loading
  },
  props: {
    resource: {
      type:     String,
      required: true,
    },

    schema: {
      type:     Object,
      required: true,
    },
  },
  async fetch() {
    await this.updateRows();

    this.canRefreshAccess = await this.$store.dispatch('rancher/request', { url: '/v3/users?limit=0' })
      .then(res => !!res?.actions?.refreshauthprovideraccess);
  },
  data() {
    return {
      rows:             [],
      hasGroups:        false,
      canRefreshAccess: false,
      assignLocation:   {
        path:   `/c/local/${ NAME }/${ NORMAN.SPOOFED.GROUP_PRINCIPAL }/assign-edit`,
        query: { [MODE]: _EDIT }
      },
      initialLoad: true,
    };
  },
  computed: { ...mapState('action-menu', ['showPromptRemove', 'toRemove']) },
  watch:    {
    async toRemove(resources) {
      if (this.initialLoad) {
        this.initialLoad = false;

        return;
      }
      if (resources?.length === 0) {
        await this.refreshGroupMemberships(() => {});
        // spoofed collections normally get updated when promptRemove has completed (given the resources are of a spoofed type)..
        // ... however in this use case it doesn't happen so do it manually (the removed resources are not globalRoleBindings and not spoofed)
        await this.updateRows(true);
      }
    }
  },
  methods: {
    async updateRows(force = false) {
      await this.updateGroupPrincipals(force);

      // Upfront load all global roles, this makes it easier to sync fetch them later on
      await this.$store.dispatch('management/findAll', { type: MANAGEMENT.GLOBAL_ROLE });

      const principals = await this.$store.dispatch('rancher/findAll', { type: NORMAN.PRINCIPAL, opt: { url: '/v3/principals' } });

      // Are there principals that are groups? (don't use rows, it's filtered by those with roles)
      this.hasGroups = principals.filter(principal => principal.principalType === 'group')?.length;
    },
    async refreshGroupMemberships(buttonDone) {
      try {
        await this.$store.dispatch('rancher/request', {
          url:           '/v3/users?action=refreshauthprovideraccess',
          method:        'post',
          data:          { },
        });

        await this.updateGroupPrincipals(true);

        buttonDone(true);
      } catch (err) {
        this.$store.dispatch('growl/fromError', { title: 'Error refreshing group memberships', err }, { root: true });
        buttonDone(false);
      }
    },
    async updateGroupPrincipals(force = false) {
      // This is needed in SSR, but not SPA. If this is not here... when cluster/findAll is dispatched... we fail to find the spoofed
      // type's `getInstance` fn as it hasn't been registered (`instanceMethods` in type-map file is empty)
      await applyProducts(this.$store);

      // Force spoofed type getInstances to execute again
      this.rows = await this.$store.dispatch('cluster/findAll', {
        type: NORMAN.SPOOFED.GROUP_PRINCIPAL,
        opt:  { force }
      }, { root: true });
    }
  },

};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template slot="extraActions">
        <AsyncButton
          v-if="canRefreshAccess"
          mode="refresh"
          :action-label="t('authGroups.actions.refresh')"
          :waiting-label="t('authGroups.actions.refresh')"
          :success-label="t('authGroups.actions.refresh')"
          :error-label="t('authGroups.actions.refresh')"
          @click="refreshGroupMemberships"
        />
        <n-link
          v-if="hasGroups"
          :to="assignLocation"
          class="btn role-primary"
        >
          {{ t("authGroups.actions.assignRoles") }}
        </n-link>
      </template>
    </Masthead>

    <ResourceTable :schema="schema" :rows="rows" />
  </div>
</template>
