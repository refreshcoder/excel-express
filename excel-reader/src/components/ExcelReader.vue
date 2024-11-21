<template>
  <a-layout style="height: 100vh">
    <a-layout-header>
      <a-typography-title style="text-align: center" :heading="4">
        工作时长统计
      </a-typography-title>
    </a-layout-header>

    <a-layout-content style="padding: 24px">
      <div>
        <a-upload
          :file-list="fileList"
          accept=".xlsx"
          :auto-upload="false"
          @change="onFileChange"
          show-upload-list
          draggable
          :limit="1"
        >
          <a-button icon="upload">上传文件</a-button>
        </a-upload>
      </div>

      <a-form
        :model="filters"
        label-align="left"
        label-col="{ span: 6 }"
        style="margin-top: 16px"
      >
        <a-form-item label="班次">
          <a-select v-model="filters.duty" :options="dutyOptions" />
        </a-form-item>

        <a-form-item label="校准状态">
          <a-select v-model="filters.checkedStatus" :options="statusOptions" />
        </a-form-item>

        <a-form-item label="打卡次数">
          <a-select v-model="filters.times" :options="timesOptions" />
        </a-form-item>
      </a-form>

      <div style="display: flex; justify-content: space-between">
        <a-button style="margin-left: 8px" @click="resetFilters">重置</a-button>

        <a-button
          type="primary"
          :disabled="!fileList.length"
          @click="processFile"
        >
          统计
        </a-button>
      </div>

      <a-list style="margin-top: 16px">
        <template #header>
          <div style="text-align: center">统计结果</div>
        </template>
        <a-list-item v-for="(item, index) in resultList" :key="index">
          <a-list-item-meta
            :title="item.label"
            :description="item.value.toString()"
          />
        </a-list-item>
      </a-list>
      <SCalender :data="resultWeeks" />
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { parseExcelFile, type ParseRes } from "@/utils/reader";
import { computed, ref } from "vue";
import SCalender from "./SCalender.vue";
import { useLocalStorage } from "@vueuse/core";

// 文件和数据
const fileList = ref<any[]>([]); // arco-design-vue 文件列表
const result = ref<ParseRes>({ weeks: [], detail: {} }); // 解析结果

const resultWeeks = computed(() => {
  return result.value.weeks;
});
const resultList = computed(() => {
  return Object.entries(result.value.detail).map(([k, v]) => ({
    label: k,
    value: v,
  }));
});

// 筛选配置
const filters = useLocalStorage("___filters", {
  duty: "非休息",
  checkedStatus: "正常",
  times: "2",
});

const dutyOptions = [
  { label: "不限", value: "" },
  { label: "非休息", value: "非休息" },
];
const statusOptions = [
  { label: "不限", value: "" },
  { label: "正常", value: "正常" },
  { label: "非请假休息一律统计", value: "非请假休息一律统计" },
];
const timesOptions = [
  { label: "不限(漏打卡按标准工作时长计)", value: "" },
  { label: "2次", value: "2" },
];

// 上传文件逻辑
const onFileChange = (files: File[]) => {
  fileList.value = [...files];
};

// 处理上传的文件
const processFile = async () => {
  if (!fileList.value.length) {
    alert("请先上传文件");
    return;
  }

  const file = fileList.value[0].file;
  if (file) {
    try {
      const data = await parseExcelFile(file, filters.value);
      result.value = data;
    } catch (error) {
      console.error("解析失败:", error);
    }
  }
};

const resetFilters = () => {
  filters.value = { duty: "非休息", checkedStatus: "正常", times: "2" };
};
</script>

<style scoped>
:deep(.arco-upload-progress) {
  display: none;
}
</style>
