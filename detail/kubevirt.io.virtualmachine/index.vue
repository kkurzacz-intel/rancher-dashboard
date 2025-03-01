<script>
import { mapGetters } from 'vuex';
import Tabbed from '@/components/Tabbed';
import Tab from '@/components/Tabbed/Tab';
import { EVENT, HCI, SERVICE, NODE } from '@/config/types';
import CreateEditView from '@/mixins/create-edit-view';
import DashboardMetrics from '@/components/DashboardMetrics';
import { allHash } from '@/utils/promise';
import NodeScheduling from '@/components/form/NodeScheduling';
import { allDashboardsExist } from '@/utils/grafana';
import OverviewBasics from './VirtualMachineTabs/VirtualMachineBasics';
import OverviewDisks from './VirtualMachineTabs/VirtualMachineDisks';
import OverviewNetworks from './VirtualMachineTabs/VirtualMachineNetworks';
import OverviewKeypairs from './VirtualMachineTabs/VirtualMachineKeypairs';
import OverviewCloudConfigs from './VirtualMachineTabs/VirtualMachineCloudConfigs';
import Migration from './VirtualMachineTabs/VirtualMachineMigration';
import Events from './VirtualMachineTabs/VirtualMachineEvents';

const VM_METRICS_DETAIL_URL = '/api/v1/namespaces/cattle-monitoring-system/services/http:rancher-monitoring-grafana:80/proxy/d/harvester-vm-detail-1/vm-info-detail?orgId=1';

export default {
  name: 'VMIDetailsPage',

  components: {
    Tab,
    Tabbed,
    Events,
    OverviewBasics,
    OverviewDisks,
    OverviewNetworks,
    OverviewKeypairs,
    OverviewCloudConfigs,
    NodeScheduling,
    Migration,
    DashboardMetrics,
  },

  mixins: [CreateEditView],

  props: {
    value: {
      type:     Object,
      required: true,
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    const hash = {
      services: this.$store.dispatch(`${ inStore }/findAll`, { type: SERVICE }),
      events:   this.$store.dispatch(`${ inStore }/findAll`, { type: EVENT }),
      allSSHs:  this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SSH }),
    };

    await allHash(hash);

    this.showVmMetrics = await allDashboardsExist(this.$store.dispatch, this.currentCluster.id, [VM_METRICS_DETAIL_URL], 'harvester');
  },

  data() {
    return {
      switchToCloud: false,
      VM_METRICS_DETAIL_URL,
      showVmMetrics: false,
    };
  },

  computed: {
    ...mapGetters(['currentCluster']),

    vmi() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      const vmiList = this.$store.getters[`${ inStore }/all`](HCI.VMI) || [];
      const vmi = vmiList.find( (VMI) => {
        return VMI?.metadata?.ownerReferences?.[0]?.uid === this.value?.metadata?.uid;
      });

      return vmi;
    },

    nodesIdOptions() {
      const nodes = this.$store.getters['harvester/all'](NODE) || [];

      return nodes.map(node => node.id);
    },

    allEvents() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.$store.getters[`${ inStore }/all`](EVENT);
    },

    events() {
      return this.allEvents.filter((e) => {
        const { name, creationTimestamp } = this.value?.metadata || {};
        const podName = this.value.podResource?.metadata?.name;
        const involvedName = e?.involvedObject?.name;

        return (involvedName === name || involvedName === podName) && e.firstTimestamp >= creationTimestamp;
      }).sort((a, b) => {
        if (a.lastTimestamp > b.lastTimestamp) {
          return -1;
        }

        return 1;
      });
    },

    graphVars() {
      return {
        namespace: this.value.namespace,
        vm:        this.value.name
      };
    },

    hasMetrics() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return !!this.$store.getters[`${ inStore }/byId`]('service', 'cattle-monitoring-system/rancher-monitoring-grafana');
    },
  },

  methods: {
    tabChanged({ tab = {} }) {
      this.switchToCloud = tab.name === 'cloudConfig';
    },
  }
};
</script>

<template>
  <div>
    <Tabbed v-bind="$attrs" class="mt-15" :side-tabs="true" @changed="tabChanged">
      <Tab name="basics" :label="t('harvester.virtualMachine.detail.tabs.basics')" class="bordered-table" :weight="7">
        <OverviewBasics v-model="value" :resource="vmi" mode="view" />
      </Tab>

      <Tab name="disks" :label="t('harvester.tab.volume')" class="bordered-table" :weight="6">
        <OverviewDisks v-model="value" />
      </Tab>

      <Tab name="networks" :label="t('harvester.virtualMachine.detail.tabs.networks')" class="bordered-table" :weight="5">
        <OverviewNetworks v-model="value" />
      </Tab>

      <Tab :label="t('workload.container.titles.nodeScheduling')" name="nodeScheduling" :weight="4">
        <NodeScheduling :mode="mode" :value="value.spec.template.spec" :nodes="nodesIdOptions" />
      </Tab>

      <Tab name="keypairs" :label="t('harvester.virtualMachine.detail.tabs.keypairs')" class="bordered-table" :weight="3">
        <OverviewKeypairs v-model="value" />
      </Tab>

      <Tab name="cloudConfig" :label="t('harvester.virtualMachine.detail.tabs.cloudConfig')" class="bordered-table" :weight="2">
        <OverviewCloudConfigs v-model="value" :active="switchToCloud" />
      </Tab>

      <Tab name="event" :label="t('harvester.virtualMachine.detail.tabs.events')" :weight="1">
        <Events :resource="vmi" :events="events" />
      </Tab>

      <Tab name="migration" :label="t('harvester.virtualMachine.detail.tabs.migration')">
        <Migration v-model="value" :vmi-resource="vmi" />
      </Tab>

      <Tab
        v-if="showVmMetrics"
        name="vm-metrics"
        :label="t('harvester.virtualMachine.detail.tabs.metrics')"
        :weight="2.5"
      >
        <template #default="props">
          <DashboardMetrics
            v-if="props.active"
            :detail-url="VM_METRICS_DETAIL_URL"
            graph-height="550px"
            :has-summary-and-detail="false"
            :vars="graphVars"
          />
        </template>
      </Tab>
    </Tabbed>
  </div>
</template>
