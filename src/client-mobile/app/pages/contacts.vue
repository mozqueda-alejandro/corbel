<script setup>
import { ref } from "vue";

const fileInputElement = ref(null);
const capturedImageDataUrl = ref(null);

function openCamera() {
  fileInputElement.value.click();
}

function handleFileSelected(event) {
  const selectedFile = event.target.files[0];
  if (!selectedFile) return;

  const fileReader = new FileReader();
  fileReader.onload = () => {
    capturedImageDataUrl.value = fileReader.result;
  };
  fileReader.readAsDataURL(selectedFile);
}
</script>

<template>
  <input
    ref="fileInputElement"
    type="file"
    accept="image/*"
    capture="environment"
    style="display: none"
    @change="handleFileSelected"
  >

  <button @click="openCamera">
    Take Picture
  </button>

  <img
    v-if="capturedImageDataUrl"
    :src="capturedImageDataUrl"
    alt="Last captured picture"
  >
</template>
