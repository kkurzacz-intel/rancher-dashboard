<script>
import Loading from '@/components/Loading';
import ResourceTable from '@/components/ResourceTable';

import { allHash } from '@/utils/promise';
import { PVC, SCHEMA, HCI } from '@/config/types';
import { STATE, AGE, NAME, NAMESPACE } from '@/config/table-headers';

const schema = {
  id:         HCI.VOLUME,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.VOLUME,
    namespaced: true
  },
  metadata: { name: HCI.VOLUME },
};

export default {
  name:       'HarvesterListVolume',
  components: { Loading, ResourceTable },

  async fetch() {
    const hash = await allHash({
      pvcs: this.$store.dispatch('harvester/findAll', { type: PVC }),
      vms:  this.$store.dispatch('harvester/findAll', { type: HCI.VM })
    });

    const pvcSchema = this.$store.getters['harvester/schemaFor'](PVC);

    if (!pvcSchema?.collectionMethods.find(x => x.toLowerCase() === 'post')) {
      this.$store.dispatch('type-map/configureType', { match: HCI.VOLUME, isCreatable: false });
    }

    this.rows = hash.pvcs;
  },

  data() {
    return { rows: [] };
  },

  computed: {
    schema() {
      return schema;
    },

    headers() {
      return [
        STATE,
        NAME,
        NAMESPACE,
        {
          name:      'size',
          labelKey:  'tableHeaders.size',
          value:     'spec.resources.requests.storage',
          sort:      'volumeSort',
        },
        {
          name:      'AttachedVM',
          labelKey:  'tableHeaders.attachedVM',
          type:      'attached',
          value:     'spec.claimRef',
          sort:      'name',
        },
        {
          ...STATE,
          name:          'phase',
          labelKey:      'tableHeaders.phase',
          formatterOpts: { arbitrary: true },
          value:         'phaseState',
        },
        AGE,
      ];
    },
  },

  methods: {
    goTo(row) {
      return row?.attachVM?.detailLocation;
    },

    getVMName(row) {
      return row.attachVM?.metadata?.name || '';
    }
  },

  typeDisplay() {
    return this.$store.getters['type-map/labelFor'](schema, 99);
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <ResourceTable
    v-else
    v-bind="$attrs"
    :headers="headers"
    :groupable="true"
    default-sort-by="age"
    :namespaced="true"
    :rows="rows"
    :schema="schema"
    key-field="_key"
    v-on="$listeners"
  >
    <template slot="cell:AttachedVM" slot-scope="scope">
      <div>
        <n-link v-if="getVMName(scope.row)" :to="goTo(scope.row)">
          {{ getVMName(scope.row) }}
        </n-link>
      </div>
    </template>
  </ResourceTable>
</template>
