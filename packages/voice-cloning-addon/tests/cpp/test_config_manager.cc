#include <gtest/gtest.h>

#include <cstdio>
#include <fstream>
#include <string>

#include "config_manager.h"

using config::ConfigManager;
using config::ConfigValue;
using config::ConfigValueType;

namespace {

// ConfigManager is a process-wide singleton, so reset it around every test.
class ConfigManagerTest : public ::testing::Test {
 protected:
  void SetUp() override { config.load_defaults(); }
  void TearDown() override { config.load_defaults(); }

  ConfigManager& config = ConfigManager::get_instance();
};

std::string temp_path(const std::string& name) {
  return ::testing::TempDir() + "voice_cloning_" + name;
}

}  // namespace

TEST(ConfigValueTest, StringLiteralIsStoredAsString) {
  const ConfigValue value("./models/f5-tts");
  EXPECT_EQ(value.type, ConfigValueType::STRING);
  EXPECT_EQ(value.to_string(), "./models/f5-tts");
}

TEST(ConfigValueTest, ConvertsBetweenTypes) {
  EXPECT_EQ(ConfigValue(std::string("42")).to_int(), 42);
  EXPECT_FLOAT_EQ(ConfigValue(3).to_float(), 3.0f);
  EXPECT_TRUE(ConfigValue(std::string("true")).to_bool());
  EXPECT_TRUE(ConfigValue(std::string("1")).to_bool());
  EXPECT_FALSE(ConfigValue(0).to_bool());
  EXPECT_EQ(ConfigValue(true).to_string(), "true");
}

TEST_F(ConfigManagerTest, ProvidesAudioDefaults) {
  EXPECT_EQ(config.get_int("audio", "target_sample_rate"), 22050);
  EXPECT_EQ(config.get_int("audio", "target_channels"), 1);
  EXPECT_FLOAT_EQ(config.get_float("audio", "normalization_threshold"), 0.95f);
  EXPECT_FALSE(config.get_bool("audio", "enable_noise_reduction"));
}

TEST_F(ConfigManagerTest, ProvidesVoiceCloningPathDefaultsAsStrings) {
  EXPECT_EQ(config.get_string("voice_cloning", "model_path"), "./models/f5-tts");
  EXPECT_EQ(config.get_string("voice_cloning", "vocoder_path"), "./models/vocoder");
}

TEST_F(ConfigManagerTest, MissingKeysReturnTheDefaultArgument) {
  EXPECT_EQ(config.get_int("nope", "missing", 7), 7);
  EXPECT_FLOAT_EQ(config.get_float("nope", "missing", 1.5f), 1.5f);
  EXPECT_TRUE(config.get_bool("nope", "missing", true));
}

TEST_F(ConfigManagerTest, SetsAndGetsEachType) {
  config.set_string("test", "string_key", "value");
  config.set_int("test", "int_key", 42);
  config.set_float("test", "float_key", 3.25f);
  config.set_bool("test", "bool_key", true);

  EXPECT_EQ(config.get_string("test", "string_key"), "value");
  EXPECT_EQ(config.get_int("test", "int_key"), 42);
  EXPECT_FLOAT_EQ(config.get_float("test", "float_key"), 3.25f);
  EXPECT_TRUE(config.get_bool("test", "bool_key"));
}

TEST_F(ConfigManagerTest, RemovesKeysAndSections) {
  config.set_int("test", "a", 1);
  config.set_int("test", "b", 2);
  ASSERT_TRUE(config.has_section("test"));

  EXPECT_TRUE(config.remove_key("test", "a"));
  EXPECT_FALSE(config.has_key("test", "a"));
  EXPECT_TRUE(config.has_key("test", "b"));
  EXPECT_FALSE(config.remove_key("test", "a"));

  EXPECT_TRUE(config.remove_section("test"));
  EXPECT_FALSE(config.has_section("test"));
}

TEST_F(ConfigManagerTest, SaveThenLoadRestoresValues) {
  const std::string path = temp_path("roundtrip.cfg");
  config.set_string("saved", "name", "hello");
  config.set_int("saved", "count", 123);
  config.set_float("saved", "ratio", 0.5f);
  config.set_bool("saved", "enabled", true);

  ASSERT_TRUE(config.save_config(path)) << config.get_error();
  config.clear();
  ASSERT_FALSE(config.has_section("saved"));
  ASSERT_TRUE(config.load_config(path)) << config.get_error();
  std::remove(path.c_str());

  EXPECT_EQ(config.get_string("saved", "name"), "hello");
  EXPECT_EQ(config.get_int("saved", "count"), 123);
  EXPECT_FLOAT_EQ(config.get_float("saved", "ratio"), 0.5f);
  EXPECT_TRUE(config.get_bool("saved", "enabled"));
}

TEST_F(ConfigManagerTest, ParsesHandWrittenFile) {
  const std::string path = temp_path("handwritten.cfg");
  {
    std::ofstream file(path);
    file << "# comment\n"
         << "[server]\n"
         << "host = localhost\n"
         << "port = 8080\n"
         << "scale = 1.5\n"
         << "debug = false\n";
  }

  ASSERT_TRUE(config.load_config(path)) << config.get_error();
  std::remove(path.c_str());

  EXPECT_EQ(config.get_string("server", "host"), "localhost");
  EXPECT_EQ(config.get_int("server", "port"), 8080);
  EXPECT_FLOAT_EQ(config.get_float("server", "scale"), 1.5f);
  EXPECT_FALSE(config.get_bool("server", "debug", true));
}

TEST_F(ConfigManagerTest, LoadingMissingFileFails) {
  EXPECT_FALSE(config.load_config(temp_path("does_not_exist.cfg")));
  EXPECT_FALSE(config.get_error().empty());
}
