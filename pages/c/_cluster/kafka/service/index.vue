<script>
import Loading from '@/components/Loading';
import Tabbed from '@/components/Tabbed';
import Tab from '@/components/Tabbed/Tab';
import TypeDescription from '@/components/TypeDescription';

import ResourceTable from '@/components/ResourceTable';
import { KAFKA, MONITORING } from '@/config/types';
import { allHash } from '@/utils/promise';
export default {
  components: {
    Loading, Tabbed, Tab, ResourceTable, TypeDescription
  },

  async fetch() {
    this.kafkaService = this.$store.getters['cluster/schemaFor'](KAFKA.SERVICE);
    this.serviceMonitorSchema = this.$store.getters['cluster/schemaFor'](MONITORING.SERVICEMONITOR);

    const hash = await allHash( {
      kafkaServices:     this.$store.dispatch('cluster/findAll', { type: KAFKA.SERVICE } ),
      serviceMonitors: this.$store.dispatch('cluster/findAll', { type: MONITORING.SERVICEMONITOR } )
    });

    this.kafkaServices = hash.kafkaServices;
    this.serviceMonitors = hash.serviceMonitors;
  },

  data() {
    const initTab = this.$route.query.resource || MONITORING.SPOOFED.PODMONITOR;

    return {
      kafkaServices: [], serviceMonitors: [], kafkaService: null, serviceMonitorSchema: null, initTab
    };
  },

  computed: {
    createRoute() {
      const activeResource = this.$refs?.tabs?.activeTabName || this.routeSchema.id;

      return {
        name:   'c-cluster-kafka-service-create',
        params: { cluster: this.$route.params.cluster },
        query:  { resource: activeResource }
      };
    },
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <div class="row header mb-40">
      <h1>  Kafka creation</h1>
      <div>
        <button class="btn btn-lg role-primary float right" @click="$router.push(createRoute)">
          {{ t('resourceList.head.createFromYaml') }}
        </button>
      </div>
    </div>
    <Tabbed ref="tabs" :default-tab="initTab">
      <Tab :name="kafkaService.id" :label="$store.getters['type-map/labelFor'](kafkaService, 2)">
        <TypeDescription :resource="kafkaService.id" />
        <ResourceTable :schema="kafkaService" :rows="kafkaServices" />
      </Tab>
      <Tab :name="serviceMonitorSchema.id" :label="$store.getters['type-map/labelFor'](serviceMonitorSchema, 2)">
        <TypeDescription :resource="serviceMonitorSchema.id" />
        <ResourceTable :schema="serviceMonitorSchema" :rows="serviceMonitors" />
      </Tab>
    </Tabbed>
  </div>
</template>

<style lang='scss' scoped>
.header{
  display: flex;
  H1{
    flex: 1;
  }
}
</style>
