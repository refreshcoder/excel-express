<template>
  <a-layout style="height: 100vh; max-width: 960px; margin: 0 auto;">
    <a-layout-header>
      <a-typography-title style="text-align: center" :heading="4">
        工作时长统计
      </a-typography-title>
    </a-layout-header>

    <a-layout-content style="margin: 0 24px 24px;">
      <div>
        <a-upload
          ref="aUploadRef"
          :file-list="fileList"
          :auto-upload="false"
          @change="onFileChange"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          show-upload-list
          :limit="1"
          draggable
        >
          <a-button icon="upload">上传文件</a-button>
        </a-upload>
      </div>

      <a-form
        :model="filters"
        label-align="left"
        label-col="{ span: 6 }"
        style="margin-top: 20px"
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
        <a-button @click="resetFilters">重置</a-button>

        <a-button
          type="primary"
          :disabled="!fileList.length"
          @click="processFile"
        >
          统计
        </a-button>
      </div>

      <a-list style="margin-top: 20px" size="small">
        <template #header>
          <div style="text-align: center; margin-bottom: 8px;">统计结果</div>
          <SCalender style="margin-bottom: 12px;" :data="resultWeeks" />
        </template>
        <a-list-item v-for="(item, index) in resultList" :key="index">
          <a-list-item-meta
            :title="item.label"
          />
          <template #extra>
            <a-space style="height: 100%;" align="center">
              {{ item.value.toString() }}
            </a-space>
          </template>
        </a-list-item>
      </a-list>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { parseExcelFile, type ParseRes } from "@/utils/reader";
import { computed, ref } from "vue";
import SCalender from "./SCalender.vue";
import { useLocalStorage } from "@vueuse/core";
import type { FileItem } from "@arco-design/web-vue";

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
const onFileChange = (files: FileItem[]) => {
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
:deep(.arco-upload-drag) {
  padding: 16px 0;
}

:deep(.arco-upload-progress) {
  display: none;
}
</style>
